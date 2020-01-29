import * as path from 'path';
import * as jsyaml from 'js-yaml';
import { qorus_webview } from '../QorusWebview';
import { InterfaceCreator } from './InterfaceCreator';
import { class_template, subclass_template } from './common_constants';
import { job_template } from './job_constants';
import { workflow_template } from './workflow_constants';
import { step_template } from './step_constants';
import { stepTypeHeaders } from './step_constants';
import { connectionsCode } from './class_connections';
import { hasConfigItems } from '../qorus_utils';
import { t } from 'ttag';
import * as msg from '../qorus_message';


class ClassCreator extends InterfaceCreator {
    editImpl({data, orig_data, edit_type, iface_id, iface_kind, open_file_on_success}) {
        let template: any;
        let suffix: string;
        switch (iface_kind) {
            case 'job':
                template = job_template;
                suffix = '.qjob';
                break;
            case 'step':
                template = step_template;
                suffix = '.qstep';
                break;
            case 'workflow':
                if (data['class-name']) {
                    template = workflow_template;
                    suffix = '.qwf';
                }
                break;
            case 'class':
                template = data['base-class-name'] ? subclass_template : class_template;
                suffix = '.qclass';
                break;
            case 'mapper':
            case 'other':
                break;
            default:
                msg.log(t`InvalidIfaceKind ${iface_kind} ${'ClassCreator'}`);
                return;
        }

        let header_data = this.init(data, suffix);

        if (iface_kind === 'step' && header_data['base-class-name']) {
            header_data = {
                ...header_data,
                ...stepTypeHeaders(this.code_info.stepType(header_data['base-class-name']))
            };
        }

        let contents: string;
        let message: string;
        let code_lines: string[];
        let orig_file_path: string;
        switch (edit_type) {
            case 'create':
                if (!this.hasCode()) {
                    message = t`FileCreatedInDir ${this.yaml_file_name} ${this.target_dir}`;
                    break;
                }

                let connections_inside: string = '';
                let connections_outside: string = '';
                if (data['class-connections']) {
                    ({connections_inside, connections_outside}
                                        = connectionsCode(data['class-connections'], this.lang));
                }

                contents = this.fillTemplate(template, {
                    class_name: data['class-name'],
                    base_class_name: data['base-class-name'],
                    connections_inside,
                    connections_outside
                });

                message = t`2FilesCreatedInDir ${this.file_name} ${this.yaml_file_name} ${this.target_dir}`;
                break;
            case 'edit':
                const {
                    target_dir: orig_target_dir,
                    target_file: orig_target_file,
                    ...other_orig_data
                } = orig_data;

                orig_file_path = path.join(orig_target_dir, orig_target_file);

                if (!this.hasCode()) {
                    break;
                }

                this.edit_info = this.code_info.editInfo(orig_file_path);

                code_lines = this.edit_info.text_lines;
                code_lines = this.renameClassAndBaseClass(code_lines,
                                                          other_orig_data,
                                                          header_data);
                contents = code_lines.join('\n');
                break;
            default:
                msg.error(t`UnknownEditType`);
                return;
        }

        let headers = ClassCreator.createHeaders({
            type: iface_kind,
            ...header_data,
            code: this.hasCode() ? this.file_name : undefined
        });

        const iface_data = this.code_info.interface_info.getInfo(iface_id);
        const hasArrayTag = tag => iface_data && iface_data[tag] && iface_data[tag].length;
        if (hasArrayTag('config-items')) {
            headers += ClassCreator.createConfigItemHeaders(iface_data['config-items']);
        }

        if (iface_kind === 'workflow' && hasArrayTag('config-item-values')) {
            headers += jsyaml.safeDump({'config-item-values': iface_data['config-item-values']}, {indent: 2})
                             .replace(/\r?\n  -\r?\n/g, '\n  - ');
        }

        this.hasCode()
            ? this.writeFiles(contents, headers, open_file_on_success)
            : this.writeYamlFile(headers);

        if (message) {
            msg.info(message);
        }

        delete data.yaml_file;
        qorus_webview.opening_data = {
            tab: 'CreateInterface',
            subtab: iface_kind,
            [iface_kind]: data
        };

        this.deleteOrigFilesIfDifferent(orig_file_path);
        if (hasConfigItems(iface_kind)) {
            this.code_info.interface_info.setOrigConfigItems(iface_id, edit_type === 'edit');
        }
    }
}

export const class_creator = new ClassCreator();
