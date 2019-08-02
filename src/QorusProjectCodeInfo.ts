import * as vscode from 'vscode';
import * as child_process from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import * as yaml from 'yamljs';
import { qore_vscode } from './qore_vscode';
import { QorusProject } from './QorusProject';
import { filesInDir, canBeParsed, isServiceClass } from './qorus_utils';
import { t } from 'ttag';
import * as msg from './qorus_message';
import { getSuffix } from './qorus_utils';


const object_parser_command = 'qop.q -i';
const object_chunk_length = 100;
const root_service = 'QorusService';
const root_job = 'QorusJob';
const root_workflow = 'QorusWorkflow';

export class QorusProjectCodeInfo {
    private project: QorusProject;
    private pending: boolean = true;
    private code_info: any = {};
    private yaml_data_by_file: any = {};
    private yaml_data_by_class: any = {};
    private file_tree: any = {};
    private dir_tree: any = {};
    private inheritance_pairs: any = {};
    private service_classes = [root_service];
    private job_classes = [root_job];
    private workflow_classes = [root_workflow];

    constructor(project: QorusProject) {
        this.project = project;
    }

    get yaml_info_by_file(): any {
        return this.yaml_data_by_file;
    }

    get yaml_info_by_class(): any {
        return this.yaml_data_by_class;
    }

    baseClassName(class_name: string): string | undefined {
        return this.inheritance_pairs[class_name];
    }

    getObjects(object_type: string, webview: vscode.Webview) {
        let return_type: string;
        let interval_id: any;

        const getObjectsCheckPending = () => {
            if (this.pending) {
                return;
            }

            clearInterval(interval_id);

            let objects: any[] = [];
            switch (object_type) {
                case 'service-base-class':
                    return_type = 'objects';
                    objects = this.addDescToBaseClasses(this.service_classes);
                    break;
                case 'job-base-class':
                    return_type = 'objects';
                    objects = this.addDescToBaseClasses(this.job_classes);
                    break;
                case 'author':
                case 'function':
                case 'class':
                case 'constant':
                case 'mapper':
                case 'value-map':
                case 'module':
                case 'group':
                case 'tag':
                    return_type = 'objects';
                    objects = this.code_info[object_type] || [];
                    break;
                case 'resource':
                case 'text-resource':
                case 'bin-resource':
                case 'template':
                    return_type = 'resources';
                    objects = this.file_tree;
                    break;
                case 'target-dir':
                    return_type = 'directories';
                    objects = this.dir_tree;
                    break;
                default:
                    objects = [];
            }

            webview.postMessage({
                action: 'creator-return-' + return_type,
                object_type,
                [return_type]: objects
            });
        };

        interval_id = setInterval(getObjectsCheckPending, 200);
    }

    update() {
        this.updateFileTree();

        this.project.validateConfigFileAndDo(file_data => {
            if (file_data.source_directories.length === 0) {
                this.pending = false;
                return;
            }

            this.updateYamlInfo(file_data.source_directories);

            this.updateBaseClassesInfo(file_data.source_directories);

            setTimeout(() => {
                this.updateObjects(file_data.source_directories);
            }, 100);

            msg.log(t`CodeInfoUpdateStarted ${this.project.folder}` + ' ' + new Date().toString());
            this.pending = true;
        });
    }

    addSingleYamlInfo(file: string) {
        const yaml_data = { ...yaml.load(file), yaml_file: file };
        if (yaml_data.code) {
            const src = path.join(path.dirname(file), yaml_data.code);
            this.yaml_data_by_file[src] = yaml_data;
        }
        if (yaml_data['class-name']) {
            this.yaml_data_by_class[yaml_data['class-name']] = yaml_data;
        }
    }

    private updateYamlInfo(source_directories: string[]) {
        for (let dir of source_directories) {
            const full_dir = path.join(this.project.folder, dir);
            if (!fs.existsSync(full_dir)) {
                continue;
            }

            let files = filesInDir(full_dir, path => getSuffix(path) === 'yaml');
            for (let file of files) {
                this.addSingleYamlInfo(file);
            }
        }
    }

    private async updateBaseClassesInfo(source_directories: string[]) {
        await this.makeInheritancePairs(source_directories);

        const baseClasses = (base_classes: string[], inheritance_pairs) => {
            let any_new = true;
            while (any_new) {
                any_new = false;
                for (let name in inheritance_pairs) {
                    if (base_classes.includes(inheritance_pairs[name])) {
                        base_classes.push(name);
                        delete inheritance_pairs[name];
                        any_new = true;
                        break;
                    }
                }
            }
        }

        baseClasses(this.service_classes, Object.assign({}, this.inheritance_pairs));
        baseClasses(this.job_classes, Object.assign({}, this.inheritance_pairs));
        baseClasses(this.workflow_classes, Object.assign({}, this.inheritance_pairs));
    }

    private addDescToBaseClasses(base_classes: string[]): any[] {
        let ret_val = [];
        for (const base_class of base_classes) {
            const desc = base_class === root_service
                ? t`RootServiceDesc`
                : this.yaml_data_by_class[base_class]
                    ? this.yaml_data_by_class[base_class].desc
                    : undefined;
            ret_val.push({name: base_class, desc});
        }
        return ret_val;
    }

    private async makeInheritancePairs(source_directories: string[]) {
        let num_pending = 0;
        for (let dir of source_directories) {
            const full_dir = path.join(this.project.folder, dir);
            if (!fs.existsSync(full_dir)) {
                continue;
            }

            let files = filesInDir(full_dir, isServiceClass);
            for (let file of files) {
                num_pending++;

                const file_content = fs.readFileSync(file);
                const buffer: Buffer = Buffer.from(file_content);
                const contents = buffer.toString();

                const data = {
                    uri: 'file:' + file,
                    text: contents,
                    languageId: 'qore',
                    version: 1
                };

                qore_vscode.exports.getDocumentSymbols(data, 'node_info').then(symbols => {
                    symbols.forEach(symbol => {
                        if (symbol.name && symbol.name.name && symbol.inherits && symbol.inherits.length) {
                            const name = symbol.name.name;
                            const inherited = symbol.inherits[0];
                            if (inherited.name && inherited.name.name) {
                                this.inheritance_pairs[name] = inherited.name.name;
                            }
                        }
                    });
                    num_pending--;
                });
            }
        }

        let n = 500;
        while (num_pending && --n) {
            await new Promise(resolve => setTimeout(resolve, 200));
        }
    }

    private updateFileTree() {
        const dirItem = (abs_path: string, only_dirs: boolean, is_root: boolean = false) => ({
            abs_path,
            rel_path: is_root ? '.' : vscode.workspace.asRelativePath(abs_path, false),
            dirs: [],
            ... only_dirs ? {} : { files: [] }
        });

        const subDirRecursion = (tree_item: any, only_dirs: boolean) => {
            const dir_entries: string[] = fs.readdirSync(tree_item.abs_path);
            for (let entry of dir_entries) {
                const entry_path: string = path.join(tree_item.abs_path, entry);
                if (fs.lstatSync(entry_path).isDirectory()) {
                    let dir_item = dirItem(entry_path, only_dirs);
                    tree_item.dirs.push(dir_item);
                    subDirRecursion(dir_item, only_dirs);
                } else if (!only_dirs) {
                    tree_item.files.push({
                        abs_path: tree_item.abs_path,
                        rel_path: vscode.workspace.asRelativePath(tree_item.abs_path, false),
                        name: entry
                    });
                }
            }
        };

        this.project.validateConfigFileAndDo(config_file_data => {
            let file_tree: any = dirItem(this.project.folder, false, true);
            let dir_tree: any = dirItem(this.project.folder, true, true);

            for (let dir of config_file_data.source_directories) {

                let file_tree_root = dirItem(path.join(this.project.folder, dir), false);
                file_tree.dirs.push(file_tree_root);
                subDirRecursion(file_tree_root, false);

                let dir_tree_root = dirItem(path.join(this.project.folder, dir), true);
                dir_tree.dirs.push(dir_tree_root);
                subDirRecursion(dir_tree_root, true);
            }

            this.file_tree = file_tree;
            this.dir_tree = dir_tree;
        });
    }

    private updateObjects(source_directories: string[]) {
        const spaceToDash = str => str.replace(/ /g, '-');

        const types = ['class', 'function', 'constant', 'mapper', 'value map'];

        let code_info: any = {};
        for (let type of types) {
            code_info[spaceToDash(type)] = {};
        }
        code_info.author = {};

        let num_pending = 0;
        let child_process_failed: boolean = false;

        for (let dir of source_directories) {
            if (child_process_failed) {
                break;
            }

            const full_dir = path.join(this.project.folder, dir);
            if (!fs.existsSync(full_dir)) {
                continue;
            }

            let files = filesInDir(full_dir, canBeParsed);

            while (files.length) {
                if (child_process_failed) {
                    break;
                }

                this.pending = true;
                num_pending++;

                let command_parts = files.splice(0, object_chunk_length);
                command_parts.unshift(object_parser_command);
                const command: string = command_parts.join(' ');

                child_process.exec(command, {maxBuffer: 99999999}, (error, stdout, stderr) => {

                    if (error) {
                        msg.error(t`QopError ${error}`);
                        if (stderr) {
                            msg.error(stderr);
                        }
                        this.pending = false;
                        child_process_failed = true;
                        return;
                    }

                    const objects: any[] = JSON.parse(stdout.toString());

                    for (let obj of objects) {
                        const authors = obj.tags.author || obj.tags.serviceauthor || [];
                        for (const author of authors) {
                            code_info.author[author] = { name: author };
                        }

                        if (!types.includes(obj.type)) {
                            continue;
                        }
                        if (obj.type === 'function' && obj.tags.type !== 'GENERIC') {
                            continue;
                        }

                        code_info[spaceToDash(obj.type)][obj.tags.name] = {
                            name: obj.tags.name,
                            desc: obj.tags.desc,
                        };
                    }
                    if (--num_pending == 0) {
                        this.code_info = {};
                        for (let obj_type in code_info) {
                            this.code_info[obj_type] = Object.keys(code_info[obj_type]).map(key => code_info[obj_type][key]);
                        }

                        this.pending = false;
                        msg.log(t`CodeInfoUpdateFinished ${this.project.folder}` + ' ' + new Date().toString());
                    }
                });
            }
        }
    }
}
