import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { t } from 'ttag';
import { TextDocument as LsTextDocument } from 'vscode-languageserver-types';

import { loc2range, QoreTextDocument, qoreTextDocument } from './QoreTextDocument';
import { qore_vscode } from './qore_vscode';
import { parseJavaInheritance } from './qorus_java_utils';
import { getJavaDocumentSymbolsWithWait } from './vscode_java';
import { suffixToIfaceKind, makeFileUri } from './qorus_utils';
import * as msg from './qorus_message';
import { CONN_CALL_METHOD } from './qorus_creator/ClassConnections';

export class QorusProjectEditInfo {
    private edit_info: any = {};

    getInfo = file => this.edit_info[file]

    addText(document: vscode.TextDocument) {
        const file = document.uri.fsPath;

        if (!this.edit_info[file]) {
            this.edit_info[file] = {};
        }
        this.edit_info[file].text_lines = [];
        for (let i = 0; i < document.lineCount; i++) {
            this.edit_info[file].text_lines.push(document.lineAt(i).text);
        }
    }

    addTextLines(file: string, contents: string) {
        if (!this.edit_info[file]) {
            this.edit_info[file] = {};
        }
        this.edit_info[file].text_lines = contents.split(/\r?\n/);
    }

    private addMethodInfo(
        file: string,
        method_name: string,
        decl_range: any,
        name_range: any)
    {
        if (!this.edit_info[file]) {
            this.edit_info[file] = {};
        }
        if (!this.edit_info[file].method_decl_ranges) {
            this.edit_info[file].method_decl_ranges = {};
            this.edit_info[file].method_name_ranges = {};
        }
        this.edit_info[file].method_decl_ranges[method_name] = decl_range;
        this.edit_info[file].method_name_ranges[method_name] = name_range;
    }

    static isSymbolClass = (symbol: any): boolean =>
        symbol.nodetype === 1 &&
        symbol.kind === 1

    static isSymbolExpectedClass = (symbol: any, class_name?: string): boolean =>
        class_name &&
        symbol.nodetype === 1 &&
        symbol.kind === 1 &&
        class_name === symbol.name?.name

    static isJavaSymbolExpectedClass = (symbol: any, class_name?: string): boolean =>
        class_name &&
        symbol.kind === 5 &&
        class_name === symbol.name

    private addClassInfo = (file: string, symbol: any, base_class_name?: string, message_on_mismatch: boolean = true) => {
        const class_def_range: vscode.Range = loc2range(symbol.loc);
        const class_name_range: vscode.Range = loc2range(symbol.name.loc, 'class ');

        const num_inherited = (symbol.inherits || []).length;
        const base_class_names = (symbol.inherits || []).map(inherited => inherited.name.name);

        const addClass = (main_base_class_ord: number = -1) => {
            if (!this.edit_info[file]) {
                this.edit_info[file] = {};
            }
            Object.assign(this.edit_info[file], {
                class_def_range,
                class_name_range,
                main_base_class_name_range: main_base_class_ord === -1
                    ? undefined
                    : loc2range(symbol.inherits[main_base_class_ord].name.loc),
                first_base_class_line: num_inherited > 0
                    ? loc2range(symbol.inherits[0].name.loc).start.line
                    : undefined,
                last_class_line: loc2range(symbol.loc).end.line,
                base_class_names,
                main_base_class_ord
            });
        };

        if (num_inherited > 0) {
            if (base_class_name) {
                const index = symbol.inherits.findIndex(inherited =>
                    inherited.name && inherited.name.name === base_class_name);

                if (index > -1) {
                    addClass(index);
                } else {
                    if (message_on_mismatch) {
                        msg.error(t`SrcAndYamlBaseClassMismatch ${base_class_name} ${file}`);
                    }
                    addClass();
                }
            } else {
                addClass();
            }
        } else {
            if (base_class_name) {
                msg.error(t`SrcAndYamlBaseClassMismatch ${base_class_name} ${file}`);
            }
            addClass();
        }
    }

    addJavaClassInfo = (file: string, symbol: any, base_class_name?: string, message_on_mismatch: boolean = true) => {
        const class_def_range: vscode.Range = symbol.range;
        const class_name_range: vscode.Range = symbol.selectionRange;

        const addClass = (main_base_class_ord: number = -1) => {
            if (!this.edit_info[file]) {
                this.edit_info[file] = {};
            }
            Object.assign(this.edit_info[file], {
                class_def_range,
                class_name_range,
                main_base_class_name_range: main_base_class_ord === -1
                    ? undefined
                    : symbol.extends.range,
                first_base_class_line: symbol.extends
                    ? symbol.extends.range.start.line
                    : undefined,
                last_class_line: symbol.range.end.line,
                base_class_names: base_class_name ? [base_class_name] : [],
                main_base_class_ord
            });
        };

        if (symbol.extends) {
            if (base_class_name) {
                if (symbol.extends.name === base_class_name) {
                    addClass(0);
                } else {
                    if (message_on_mismatch) {
                        msg.error(t`SrcAndYamlBaseClassMismatch ${base_class_name} ${file}`);
                    }
                    addClass();
                }
            } else {
                addClass();
            }
        } else {
            if (base_class_name) {
                msg.error(t`SrcAndYamlBaseClassMismatch ${base_class_name} ${file}`);
            }
            addClass();
        }
    }

    static isDeclPublicMethod = (decl: any): boolean => {
        if (decl.nodetype !== 1 || decl.kind !== 4) { // declaration && function
            return false;
        }

        if (decl.modifiers.indexOf('private') > -1) {
            return false;
        }

        return true;
    }

    private maybeAddClassConnectionMemberDeclaration = (file, decl) => {
        if (decl.nodetype !== 1 || decl.kind !== 7) { // declaration && member group
            return;
        }

        for (const member of decl.members || []) {
            if (member.declaration?.typeName?.name === this.edit_info[file].class_connections_class_name) {
                this.edit_info[file].class_connections_member_name = member.declaration.name?.name
                this.edit_info[file].class_connections_member_declaration_loc = member.loc;
                return;
            }
        }
    }

    private maybeAddClassConnectionMemberInitialization = (file, decl) => {
        if (decl.nodetype !== 1 || decl.kind !== 4 || decl.name?.name !== 'constructor') { // declaration && function
            return;
        }

        for (const statement of decl.body?.statements || []) {
            const right = statement.expression?.right;
            if (right?.op !== 'New') {
                continue;
            }
            if (right.expression?.target?.name?.name === this.edit_info[file].class_connections_class_name ) {
                this.edit_info[file].class_connections_member_initialization_loc = statement.loc;
                const left = statement.expression.left;
                const member_name = this.edit_info[file].class_connections_member_name;
                if (member_name && member_name !== left.name?.name) {
                    msg.log(`Class connections member name mismatch: ${member_name} != ${left.name.name}`);
                }
            }
        }
    }

    private addClassDeclInfo = (file: string, decl: any) => {
        const method_name = decl.name.name;
        const decl_range = loc2range(decl.loc);
        const name_range = loc2range(decl.name.loc);

        this.addMethodInfo(file, method_name, decl_range, name_range);
    }

    addJavaClassDeclInfo = (file: string, decl: any): boolean => {
        if (decl.kind !== 6) { // must be method
            return false;
        }

        this.addMethodInfo(file, decl.name.replace('()', ''), decl.range, decl.selectionRange);

        return true;
    }

    addFileInfo(file: string, data: any, force: boolean = true): Promise<void> {
        const iface_kind = suffixToIfaceKind(path.extname(file));
        if (!iface_kind || (this.edit_info[file] && !force)) {
            return Promise.resolve();
        }

        const {
            'class-name': class_name,
            'base-class-name': base_class_name,
            'class-connections': class_connections
        } = data;

        const findClassConnectionClass = symbols => {
            if (!class_connections) {
                return undefined;
            }

            let has_the_method = false;

            const class_connection_names = Object.keys(class_connections);
            for (const symbol of symbols) {
                if (QorusProjectEditInfo.isSymbolExpectedClass(symbol, class_name) ||
                    !QorusProjectEditInfo.isSymbolClass(symbol))
                {
                    continue;
                }

                const decls = symbol.declarations;
                for (const decl of decls) {
                    if (!QorusProjectEditInfo.isDeclPublicMethod(decl)) {
                        continue;
                    }
                    const method_name = decl.name?.name;
                    has_the_method = has_the_method || method_name === CONN_CALL_METHOD;
                    if (has_the_method && class_connection_names.includes(method_name)) {
                        return symbol.name?.name;
                    }
                }
            }

            return undefined;
        };

        const doc: QoreTextDocument = qoreTextDocument(file);
        this.addTextLines(file, doc.text);

        return qore_vscode.exports.getDocumentSymbols(doc, 'node_info').then(symbols => {
            this.edit_info[file].class_connections_class_name = findClassConnectionClass(symbols);

            symbols.forEach(symbol => {
                if (!QorusProjectEditInfo.isSymbolExpectedClass(symbol, class_name)) {
                    return;
                }

                this.addClassInfo(file, symbol, base_class_name);

                if (!['service', 'mapper-code'].includes(iface_kind)) {
                    return;
                }

                for (const decl of symbol.declarations || []) {
                    if (this.edit_info[file].class_connections_class_name) {
                        this.maybeAddClassConnectionMemberDeclaration(file, decl);
                        this.maybeAddClassConnectionMemberInitialization(file, decl);
                    }
                    if (QorusProjectEditInfo.isDeclPublicMethod(decl)) {
                        this.addClassDeclInfo(file, decl);
                    }
                }
            });
            msg.debug({edit_info: this.edit_info});
            return Promise.resolve();
        });
    }

    addJavaFileInfo(
        file_path: string,
        iface_kind: string,
        class_name?: string,
        base_class_name?: string,
        force: boolean = true): Promise<void>
    {
        if (this.edit_info[file_path] && !force) {
            return Promise.resolve();
        }

        const doc: QoreTextDocument = qoreTextDocument(file_path);
        this.addTextLines(file_path, doc.text);

        return getJavaDocumentSymbolsWithWait(makeFileUri(file_path)).then(async symbols => {
            if (!symbols || !symbols.length) {
                return;
            }

            const lsdoc = LsTextDocument.create(
                makeFileUri(file_path), 'java', 1, fs.readFileSync(file_path).toString()
            );
            symbols.forEach(symbol => {
                if (!QorusProjectEditInfo.isJavaSymbolExpectedClass(symbol, class_name)) {
                    return;
                }

                parseJavaInheritance(lsdoc, symbol);
                this.addJavaClassInfo(file_path, symbol, base_class_name);

                if (iface_kind !== 'service') {
                    return;
                }

                for (const child of symbol.children || []) {
                    this.addJavaClassInfo(file_path, child);
                }
            });
            return Promise.resolve();
        });
    }
}

