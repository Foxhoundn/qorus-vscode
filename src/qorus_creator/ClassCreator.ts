import * as path from 'path';
import { qorus_webview } from '../QorusWebview';
import { InterfaceCreator } from './InterfaceCreator';
import { class_template, subclass_template } from './common_constants';
import { job_template } from './job_constants';
import { stepTypeHeaders } from './step_constants';
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
                template = subclass_template;
                suffix = '.qstep';
                break;
            case 'workflow':
                if (data['class-name']) {
                    template = subclass_template;
                    suffix = '.qwf';
                }
                break;
            case 'class':
                template = data['base-class-name'] ? subclass_template : class_template;
                suffix = '.qclass';
                break;
            case 'other':
                break;
            default:
                msg.log(t`InvalidIfaceKind ${iface_kind} ${'ClassCreator'}`);
                return;
        }

        const has_code: boolean = !!template;

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
                if (!has_code) {
                    message = t`FileCreatedInDir ${this.yaml_file_name} ${this.target_dir}`;
                    break;
                }

                contents = data['base-class-name']
                    ?   this.fillTemplate(template, {
                            class_name: data['class-name'],
                            base_class_name: data['base-class-name']
                        })
                    :   this.fillTemplate(template, { class_name: data['class-name'] });
                message = t`2FilesCreatedInDir ${this.file_name} ${this.yaml_file_name} ${this.target_dir}`;
                break;
            case 'edit':
                const {target_dir: orig_target_dir, target_file: orig_target_file, ...other_orig_data} = orig_data;
                orig_file_path = path.join(orig_target_dir, orig_target_file);
                if (!has_code) {
                    break;
                }

                const edit_info = this.code_info.editInfo(orig_file_path);

                code_lines = edit_info.text_lines;
                code_lines = this.renameClassAndBaseClass(code_lines,
                                                          edit_info,
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
            code: has_code ? this.file_name : undefined
        });

        const iface_data = this.code_info.interface_info.getInfo(iface_id);
        if (iface_data && iface_data['config-items'] && iface_data['config-items'].length) {
            headers += ClassCreator.createConfigItemHeaders(iface_data['config-items']);
        }

        has_code
            ? this.writeFiles(contents, headers, open_file_on_success)
            : this.writeYamlFile(headers, open_file_on_success);

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
        this.code_info.interface_info.setOrigConfigItems(iface_id);
    }
}

export const class_creator = new ClassCreator();
