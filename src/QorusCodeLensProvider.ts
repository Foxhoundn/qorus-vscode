import * as path from 'path';
import { t, gettext } from 'ttag';
import { CodeLens, CodeLensProvider, Range, TextDocument } from 'vscode';

import { projects } from './QorusProject';
import { QorusProjectCodeInfo } from './QorusProjectCodeInfo';
import { QorusProjectEditInfo } from './QorusProjectEditInfo';
import { QoreTextDocument, loc2range } from './QoreTextDocument';
import * as msg from './qorus_message';
import { dash2Pascal, makeFileUri, suffixToIfaceKind, expectsYamlFile, isTest } from './qorus_utils';
import { qore_vscode } from './qore_vscode';

export abstract class QorusCodeLensProviderBase implements CodeLensProvider {
    protected code_info: QorusProjectCodeInfo = undefined;
    protected previous_lenses: CodeLens[] = [];

    public provideCodeLenses(document: TextDocument): Promise<CodeLens[]> {
        if (!expectsYamlFile(document.uri.fsPath)) {
            return Promise.resolve([]);
        }

        this.code_info = projects.currentProjectCodeInfo();
        return this.code_info.waitForPending(['yaml']).then(() => this.provideCodeLensesImpl(document));
    }

    protected provideCodeLensesImpl(document: TextDocument): Promise<CodeLens[]> {
        const file_path = document.uri.fsPath;
        const dir_path = path.dirname(file_path);
        const file_name = path.basename(file_path);

        const yaml_info = this.code_info.yaml_info.yamlDataBySrcFile(file_path);
        if (!yaml_info) {
            if (!isTest(file_path)) {
                msg.error(t`UnableFindYamlForSrc ${file_name}`);
            }
            return Promise.resolve([]);
        }

        const extname = path.extname(file_path);
        const iface_kind = extname === '.java' ? yaml_info.type : suffixToIfaceKind(extname);

        if (!['service', 'job', 'step', 'workflow', 'class', 'mapper-code'].includes(iface_kind)) {
            return Promise.resolve([]);
        }

        const data = {
            target_dir: dir_path,
            target_file: file_name,
            ...yaml_info
        };

        return this.provideLanguageSpecificImpl(document, file_path, iface_kind, data);
    }

    protected abstract provideLanguageSpecificImpl(
        document: TextDocument,
        file_path: string,
        iface_kind: string,
        data: any
    ): Promise<CodeLens[]>;

    protected addClassLenses(iface_kind: string, lenses: CodeLens[], symbol: any, data: any) {
        if (!symbol.name) {
            msg.error(t`CannotDetermineClassNamePosition`);
            return;
        }

        const range = symbol.range ? symbol.range : loc2range(symbol.name.loc);

        switch (iface_kind) {
            case 'mapper-code':
            case 'service':
                let methods_key = iface_kind === 'service' ? 'methods' : 'mapper-methods';

                let cloned_data = JSON.parse(JSON.stringify(data));
                cloned_data[methods_key] = [...cloned_data[methods_key] || [], { name: '', desc: '' }];

                lenses.push(new CodeLens(range, {
                    title: gettext('Edit' + dash2Pascal(iface_kind)),
                    command: 'qorus.editInterface',
                    arguments: [data, iface_kind],
                }));

                lenses.push(new CodeLens(range, {
                    title: t`AddMethod`,
                    command: 'qorus.editInterface',
                    arguments: [{ ...cloned_data, active_method: cloned_data[methods_key].length }, iface_kind],
                }));

                break;
            case 'job':
            case 'step':
            case 'class':
                lenses.push(new CodeLens(range, {
                    title: gettext('Edit' + dash2Pascal(iface_kind)),
                    command: 'qorus.editInterface',
                    arguments: [data, iface_kind],
                }));
                break;
            case 'workflow':
                lenses.push(new CodeLens(range, {
                    title: t`EditWorkflow`,
                    command: 'qorus.editInterface',
                    arguments: [data, 'workflow'],
                }));
                lenses.push(new CodeLens(range, {
                    title: t`EditSteps`,
                    command: 'qorus.editInterface',
                    arguments: [{ ...data, show_steps: true }, 'workflow'],
                }));
                break;
            default:
                msg.log(t`InvalidIfaceKind ${iface_kind} ${'addClassLenses'}`);
        }
    }

    protected addMethodLenses(
        iface_kind: string,
        lenses: CodeLens[],
        range: Range,
        data: any,
        method_name: string,
        constructor_name: string = 'constructor')
    {
        if (method_name === constructor_name) {
            return;
        }

        const methods_key = iface_kind === 'mapper-code' ? 'mapper-methods' : 'methods';
        const method_index = (data[methods_key] || []).findIndex(method => method.name === method_name);

        if (method_index === -1) {
            msg.error(t`SrcMethodNotInYaml ${method_name} ${data.code || ''}`);
            return;
        }

        lenses.push(new CodeLens(range, {
            title: t`EditMethod`,
            command: 'qorus.editInterface',
            arguments: [{ ...data, active_method: method_index + 1 }, iface_kind],
        }));

        lenses.push(new CodeLens(range, {
            title: t`DeleteMethod`,
            command: 'qorus.deleteMethod',
            arguments: [{ ...data, method_index }, iface_kind],
        }));
    }
}

export class QorusCodeLensProvider extends QorusCodeLensProviderBase {
    protected provideLanguageSpecificImpl(document: TextDocument, file_path: string, iface_kind: string, data: any): Promise<CodeLens[]> {
        const doc: QoreTextDocument = {
            uri: makeFileUri(file_path),
            text: document.getText(),
            languageId: document.languageId,
            version: document.version
        };

        return qore_vscode.exports.getDocumentSymbols(doc, 'node_info').then(symbols => {
            if (!symbols.length) {
                return this.previous_lenses;
            }
            let lenses: CodeLens[] = [];
            data = this.code_info.fixData(data);

            symbols.forEach(symbol => {
                if (!QorusProjectEditInfo.isQoreSymbolExpectedClass(symbol, data['class-name'])) {
                    return;
                }

                this.addClassLenses(iface_kind, lenses, symbol, data);

                if (!['service', 'mapper-code'].includes(iface_kind)) {
                    return;
                }

                for (const decl of symbol.declarations || []) {
                    if (!QorusProjectEditInfo.isQoreDeclPublicMethod(decl)) {
                        continue;
                    }

                    const method_name = decl.name.name;
                    const name_range = loc2range(decl.name.loc);
                    this.addMethodLenses(iface_kind, lenses, name_range, data, method_name);
                }
            });

            this.previous_lenses = lenses;
            return lenses;
        });
    }
}
