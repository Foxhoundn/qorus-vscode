import { window, Position } from 'vscode';
import * as path from 'path';
import { qorus_webview } from '../QorusWebview';
import { InterfaceCreator } from './InterfaceCreator';
import { service_class_template, service_method_template } from './service_constants';
import { mapper_code_class_template, mapper_code_method_template } from './mapper_constants';
import { t } from 'ttag';
import * as msg from '../qorus_message';


class ClassWithMethodsCreator extends InterfaceCreator {
    private class_template: any;
    private method_template: any;

    editImpl({data, orig_data, edit_type, iface_id, iface_kind, open_file_on_success}) {
        let suffix: string;
        switch (iface_kind) {
            case 'service':
                suffix = '.qsd';
                this.class_template = service_class_template;
                this.method_template = service_method_template;
                if (!(data.methods || []).length) {
                    data.methods = [{
                        name: 'init',
                        desc: t`DefaultInitMethodDesc`,
                    }];
                }
                break;
            case 'mapper-code':
                this.class_template = mapper_code_class_template;
                this.method_template = mapper_code_method_template;
                suffix = '.qmc';
                break;
            default:
                msg.log(t`InvalidIfaceKind ${iface_kind} ${'ClassWithMethodsCreator'}`);
                return;
        }

        const {
            methods: service_methods,
           'mapper-functions': mapper_methods,
           ...header_data
        } = this.init(data, suffix);
        const methods = service_methods || mapper_methods || [];

        const {
            target_dir: orig_target_dir,
            target_file: orig_target_file,
            methods: orig_methods,
            ...other_orig_data
        } = orig_data || data || {};

        let orig_file_path: string;
        let edit_info: any;

        if (['edit', 'delete-method'].includes(edit_type)) {
            orig_file_path = path.join(orig_target_dir, orig_target_file);
            edit_info = this.code_info.editInfo(orig_file_path);
        }

        let contents: string;
        let message: string;
        let code_lines: string[];
        switch (edit_type) {
            case 'create':
                contents = this.code(data, methods);
                message = t`2FilesCreatedInDir ${this.file_name} ${this.yaml_file_name} ${this.target_dir}`;
                break;
            case 'edit':
                const orig_method_names: string[] = (orig_methods || []).map(method => method.name);
                const method_renaming_map = this.methodRenamingMap(orig_method_names, methods);

                code_lines = edit_info.text_lines;
                code_lines = this.addMethods(code_lines, edit_info, method_renaming_map.added);
                code_lines = this.renameClassAndBaseClass(code_lines,
                                                          edit_info,
                                                          other_orig_data,
                                                          header_data);
                code_lines = ClassWithMethodsCreator.renameMethods(code_lines, edit_info, method_renaming_map.renamed);
                code_lines = ClassWithMethodsCreator.removeMethods(code_lines, edit_info, method_renaming_map.removed);
                contents = code_lines.join('\n');
                break;
            case 'delete-method':
                if (typeof(data.method_index) === 'undefined') {
                    break;
                }
                const method_name = methods[data.method_index].name;
                code_lines = ClassWithMethodsCreator.removeMethods(edit_info.text_lines, edit_info, [method_name]);
                contents = code_lines.join('\n');
                if (iface_kind === 'service') {
                    message = t`ServiceMethodHasBeenDeleted ${method_name}`;
                } else {
                    message = t`MapperCodeMethodHasBeenDeleted ${method_name}`;
                }

                data.methods.splice(data.method_index, 1);

                data.active_method = data.methods.length - 1;

                break;
            default:
                msg.error(t`UnknownEditType`);
                return;
        }

        let headers = ClassWithMethodsCreator.createHeaders({
            type: iface_kind,
            ...header_data,
            servicetype: iface_kind === 'service' ? 'USER' : undefined,
            code: this.file_name
        });

        const iface_data = this.code_info.interface_info.getInfo(iface_id);
        if (iface_data && iface_data['config-items'] && iface_data['config-items'].length) {
            headers += ClassWithMethodsCreator.createConfigItemHeaders(iface_data['config-items']);
        }

        this.writeFiles(contents, headers + ClassWithMethodsCreator.createMethodHeaders(methods), open_file_on_success);

        if (message) {
            msg.info(message);
        }

        delete data.method_index;
        delete data.servicetype;
        delete data.yaml_file;
        qorus_webview.opening_data = {
            tab: 'CreateInterface',
            subtab: iface_kind,
            [iface_kind]: data
        };

        this.deleteOrigFilesIfDifferent(orig_file_path);
        this.code_info.interface_info.setOrigConfigItems(iface_id);
    }

    private methodRenamingMap(orig_names: string[], new_methods: any[]): any {
        let mapping: any = {
            added: [],
            removed: [],
            unchanged: [],
            renamed: {}
        };
        let names = {};
        for (let method of new_methods) {
            names[method.name] = true;

            if (method.name === method.orig_name) {
                mapping.unchanged.push(method.name);
            }
            else {
                if (method.orig_name) {
                    mapping.renamed[method.orig_name] = method.name;
                }
                else {
                    mapping.added.push(method.name);
                }
            }
        }

        for (let name of orig_names) {
            if (name && !names[name] && !mapping.renamed[name]) {
                mapping.removed.push(name);
            }
        }

        return mapping;
    }

    private static renameMethods(lines: string[], edit_info: any, renaming: any): string[] {
        let lines_with_renaming = {};
        for (const name of Object.keys(renaming)) {
            const range = edit_info.method_name_ranges[name];
            if (!lines_with_renaming[range.start.line]) {
                lines_with_renaming[range.start.line] = {};
            }
            lines_with_renaming[range.start.line][range.start.character] = name;
        }

        let n = -1;
        return lines.map(line => {
            if (!lines_with_renaming[++n]) {
                return line;
            }

            for (const start of Object.keys(lines_with_renaming[n]).map(key => parseInt(key)).sort((a: any, b: any) => b - a)) {
                const name = lines_with_renaming[n][start];
                let chars = line.split('');
                chars.splice(start, name.length, renaming[name]);
                line = chars.join('');
            }
            return line;
        });
    }

    private static removeMethods(lines: string[], edit_info: any, removed: string[]): string[] {
        const removeRange = (lines, range) => {
            let rows = [];
            for (let i = 0; i < range.start.line; i++) {
                rows.push(lines[i]);
            }
            rows.push(lines[range.start.line].substr(0, range.start.character));
            for (let i = range.end.line + 1; i < lines.length; i++) {
                rows.push(lines[i]);
            }
            return rows;
        }

        let rangesToRemove = removed.map(name => edit_info.method_decl_ranges[name]);
        while (rangesToRemove.length) {
            lines = removeRange(lines, rangesToRemove.pop())
        }
        return lines;
    }

    private addMethods(lines: string[], edit_info: any, added: string[]): string[] {
        const end: Position = edit_info.class_def_range.end;

        const lines_before = lines.splice(0, end.line);
        const line = lines.splice(0, 1)[0];
        const line_before = line.substr(0, end.character - 1);
        const line_after = line.substr(end.character - 1);
        const lines_after = lines;

        let new_code = line_before;
        for (let name of added) {
            new_code += '\n' + this.fillTemplate(this.method_template, { name }, false);
        }
        const new_code_lines = new_code.split(/\r?\n/);
        if (new_code_lines[new_code_lines.length - 1] === '') {
            new_code_lines.pop();
        }

        return [
            ...lines_before,
            ...new_code_lines,
            line_after,
            ...lines_after
        ];
    }

    deleteMethod(data: any, iface_kind) {
        const {methods, method_index} = data;
        if ((methods || []).length < 2) {
            if (iface_kind === 'service') {
                msg.error(t`CannotDeleteTheOnlyOneServiceMethod`);
            } else {
                msg.error(t`CannotDeleteTheOnlyOneMapperCodeMethod`);
            }
            return;
        }

        const deleted_method = methods && methods[method_index];
        if (!deleted_method) {
            msg.error(t`InvalidDeletedMethodIndex`);
            return;
        }

        window.showInformationMessage(
            t`ConfirmDeleteMethod ${deleted_method.name}`,
            t`ButtonDelete`,
            t`ButtonCancel`
        ).then(selection => {
            if (selection === t`ButtonCancel`) {
                return;
            }

            this.edit({
                data,
                iface_kind,
                edit_type: 'delete-method',
                orig_data: undefined,
                open_file_on_success : false
            });
        });
    }

    private code = (data: any, method_objects: any[]): any => {
        let method_strings = [];
        for (let method of method_objects) {
            method_strings.push(this.fillTemplate(this.method_template, { name: method.name }, false));
        }
        const methods = method_strings.join('\n');

        return this.fillTemplate(this.class_template, {
            class_name: data['class-name'],
            base_class_name: data['base-class-name'],
            methods
        });
    }

    protected static createMethodHeaders = (methods: any): string => {
        const list_indent = '  - ';
        const indent = '    ';
        let result: string = 'methods:\n';

        for (let method of methods) {
            result += `${list_indent}name: ${method.name}\n`
            for (let tag in method) {
                switch (tag) {
                    case 'name':
                    case 'orig_name':
                        break;
                    case 'author':
                        result += `${indent}author:\n`;
                        for (let author of method.author) {
                            result += `${indent}${list_indent}${author.name}\n`;
                        }
                        break;
                    default:
                        result += `${indent}${tag}: ${method[tag]}\n`
                }
            }
        }

        return result;
    }
}

export const class_with_methods_creator = new ClassWithMethodsCreator();
