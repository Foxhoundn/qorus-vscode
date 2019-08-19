import { workspace, window, Position } from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { projects } from '../QorusProject';
import { QorusProjectCodeInfo } from '../QorusProjectCodeInfo';
import { lang_suffix } from './creator_common';
import { t } from 'ttag';
import * as msg from '../qorus_message';


export abstract class InterfaceCreator {
    protected suffix: string;
    protected lang: string;
    protected target_dir: string;
    protected target_file_base: string;
    protected code_info: QorusProjectCodeInfo;

    protected constructor(suffix: string) {
        this.suffix = suffix;
    }

    protected init(data: any): any {
        const { target_dir, target_file, ...other_data } = data;

        this.target_dir = target_dir;
        this.lang = data.lang || 'qore';

        this.target_file_base = target_file
            ? path.basename(target_file, this.suffix)
            : `${data.name}-${data.version}`;

        this.code_info = projects.currentProjectCodeInfo();
        return other_data;
    }

    protected get file_name() {
        return `${this.target_file_base}${this.suffix}${lang_suffix[this.lang]}`;
    }

    protected get yaml_file_name() {
        return `${this.file_name}.yaml`;
    }

    protected get file_path() {
        return path.join(this.target_dir, this.file_name);
    }

    protected get yaml_file_path() {
        return path.join(this.target_dir, this.yaml_file_name);
    }

    protected writeFiles(contents: string, headers: string) {
        fs.writeFile(this.file_path, contents, err => {
            if (err) {
                msg.error(t`WriteFileError ${this.file_path} ${err.toString()}`);
                return;
            }
            workspace.openTextDocument(this.file_path).then(doc => window.showTextDocument(doc));
        });

        fs.writeFile(this.yaml_file_path, headers, err => {
            if (err) {
                msg.error(t`WriteFileError ${this.yaml_file_path} ${err.toString()}`);
                return;
            }
            this.code_info.addSingleYamlInfo(this.yaml_file_path);
        });
    }

    protected renameClassAndBaseClass(lines: string[], code_info: any, initial_data: any, header_data): string[] {
        const {
            class_name: orig_class_name,
            base_class_name: orig_base_class_name
        } = initial_data;
        const { class_name, base_class_name } = header_data;

        const replace = (position: Position, orig_name: string, name: string) => {
            let chars = lines[position.line].split('');
            chars.splice(position.character, orig_name.length, name);
            lines[position.line] = chars.join('');
        }

        if (base_class_name !== orig_base_class_name) {
            replace(code_info.base_class_name_range.start, orig_base_class_name, base_class_name);
        }
        if (class_name !== orig_class_name) {
            replace(code_info.class_name_range.start, orig_class_name, class_name);
        }
        return lines;
    }

    protected static createHeaders = (headers: any): string => {
        const list_indent = '  - ';
        const indent = '    ';
        let result: string = '';

        for (let key in headers) {
            const value = headers[key];
            if (!value) {
                continue;
            }

            const tag = key.replace(/_/g, '-');

            if (Array.isArray(value)) {
                switch (key) {
                    case 'groups':
                        result += 'groups:\n';
                        for (let item of value) {
                            result += `${list_indent}${item.name}\n`;
                        }
                        break;
                    case 'tags':
                        result += 'tags:\n';
                        for (let item of value) {
                            result += `${indent}${item.key}: ${item.value}\n`;
                        }
                        break;
                    case 'define_auth_label':
                        result += `${tag}:\n`;
                        for (let item of value) {
                            result += `${indent}${item.label}: ${item.value}\n`;
                        }
                        break;
                    case 'author':
                    case 'classes':
                    case 'constants':
                    case 'functions':
                    case 'vmaps':
                    case 'mappers':
                        result += `${tag}:\n`;
                        for (let item of value) {
                            result += `${list_indent}${item.name}\n`;
                        }
                        break;
                    case 'resource':
                    case 'text_resource':
                    case 'bin_resource':
                    case 'template':
                        result += `${tag}:\n`;
                        for (let item of value) {
                            result += `${list_indent}${item}\n`;
                        }
                        break;
                }
            }
            else {
                switch (key) {
                    case 'orig_name':
                        break;
                    case 'schedule':
                        const cron_values = value.split(' ');
                        if (cron_values.length !== 5) {
                            break;
                        }
                        const cron_items = ['minutes', 'hours', 'days', 'months', 'dow'];
                        result += `${tag}:\n`;
                        for (let i = 0; i < 5; i++) {
                            result += `${indent}${cron_items[i]}: "${cron_values[i]}"\n`;
                        }
                        break;
                    default:
                        result += `${tag}: ${value}\n`;
                }
            }
        }

        return result;
    }
};
