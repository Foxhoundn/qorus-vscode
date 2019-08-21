import * as vscode from 'vscode';
import * as child_process from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import * as yaml from 'yamljs';
import { qore_vscode } from './qore_vscode';
import { QorusProject } from './QorusProject';
import { qorus_webview } from './QorusWebview';
import { filesInDir, canBeParsed, isInterfaceClass, suffixToIfaceKind } from './qorus_utils';
import { t, gettext } from 'ttag';
import * as msg from './qorus_message';
import { getSuffix } from './qorus_utils';


const object_parser_command = 'qop.q -i';
const object_chunk_length = 100;
const root_service = 'QorusService';
const root_job = 'QorusJob';
const root_workflow = 'QorusWorkflow';


export interface QoreTextDocument {
    uri: string,
    text: string,
    languageId: string,
    version: number
};

export class QorusProjectCodeInfo {
    private project: QorusProject;
    private info_update_pending: any = {};
    private object_info: any = {};
    private yaml_data_by_file: any = {};
    private yaml_data_by_class: any = {};
    private file_tree: any = {};
    private dir_tree: any = {};
    private inheritance_pairs: any = {};
    private code_info: any = {service: {}, job: {}};
    private service_classes = [root_service];
    private job_classes = [root_job];
    private workflow_classes = [root_workflow];
    private object_info_types = ['author', 'class', 'function', 'constant', 'mapper', 'value-map'];
    private update_keys = ['file_tree', 'yaml', 'base_classes', 'objects'];

    constructor(project: QorusProject) {
        this.project = project;
        this.initObjectInfo();
        this.setAllPending(true);
    }

    get yaml_info_by_file(): any {
        return this.yaml_data_by_file;
    }

    get yaml_info_by_class(): any {
        return this.yaml_data_by_class;
    }

    addText(document: vscode.TextDocument) {
        const file = document.uri.fsPath;
        const iface_kind = suffixToIfaceKind(path.extname(file));

        if (!this.code_info[iface_kind][file]) {
            this.code_info[iface_kind][file] = {};
        }
        this.code_info[iface_kind][file].text_lines = [];
        for (let i = 0; i < document.lineCount; i++) {
            this.code_info[iface_kind][file].text_lines.push(document.lineAt(i).text);
        }
    }

    addClassInfo(file: string, class_name_range: any, base_class_name_range: any) {
        const iface_kind = suffixToIfaceKind(path.extname(file));

        if (!this.code_info[iface_kind][file]) {
            this.code_info[iface_kind][file] = {};
        }
        this.code_info[iface_kind][file].class_name_range = class_name_range;
        this.code_info[iface_kind][file].base_class_name_range = base_class_name_range;
    }

    addServiceMethodInfo(file: string, method_name: string, decl_range: any, name_range: any) {
        if (!this.code_info.service[file]) {
            this.code_info.service[file] = {};
        }
        if (!this.code_info.service[file].method_decl_ranges) {
            this.code_info.service[file].method_decl_ranges = {};
            this.code_info.service[file].method_name_ranges = {};
        }
        this.code_info.service[file].method_decl_ranges[method_name] = decl_range;
        this.code_info.service[file].method_name_ranges[method_name] = name_range;
    }

    codeInfo(iface_kind: string, file: string) {
        return this.code_info[iface_kind][file];
    }

    baseClassName(class_name: string): string | undefined {
        return this.inheritance_pairs[class_name];
    }

    private initObjectInfo() {
        for (const type of this.object_info_types) {
            this.object_info[type] = {};
        }
    }

    private async waitForPending(updates_base_str: string[], timeout: number = 30000) {
        const updates = updates_base_str.map(update => update + '_info_update_pending')

        const anyPending = (): boolean => {
            for (const update of updates) {
                if (this[update]) {
                    return true;
                }
            }
            return false;
        };

        const interval = 100;
        let n = timeout/interval;
        while (anyPending() && --n) {
            await new Promise(resolve => setTimeout(resolve, interval));
        }
        if (!n) {
            const pending_list = updates.filter(update => this[update]).map(update => gettext(update)).join(', ');
            msg.error(t`CodeInfoUpdateTimedOut` + pending_list);
        }
    }

    getObjects(object_type: string) {
        let return_type: string;
        let objects: any[] = [];
        switch (object_type) {
            case 'service-base-class':
                this.waitForPending(['base_classes']);
                return_type = 'objects';
                objects = this.addDescToBaseClasses(this.service_classes, root_service, t`RootServiceDesc`);
                break;
            case 'job-base-class':
                this.waitForPending(['base_classes']);
                return_type = 'objects';
                objects = this.addDescToBaseClasses(this.job_classes, root_job, t`RootJobDesc`);
                break;
            case 'workflow-base-class':
                this.waitForPending(['base_classes']);
                return_type = 'objects';
                objects = this.addDescToBaseClasses(this.workflow_classes, root_job, t`RootWorkflowDesc`);
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
                this.waitForPending(['objects', 'yaml']);
                return_type = 'objects';
                objects = Object.keys(this.object_info[object_type]).map(key => this.object_info[object_type][key]);
                break;
            case 'resource':
            case 'text-resource':
            case 'bin-resource':
            case 'template':
                this.waitForPending(['file_tree']);
                return_type = 'resources';
                objects = this.file_tree;
                break;
            case 'target-dir':
                this.waitForPending(['file_tree']);
                return_type = 'directories';
                objects = this.dir_tree;
                break;
            default:
                objects = [];
        }

        qorus_webview.postMessage({
            action: 'creator-return-' + return_type,
            object_type,
            [return_type]: objects
        });
    }

    private setAllPending(pending: boolean = true) {
        for (const key of this.update_keys) {
            this.info_update_pending[key] = pending;
        }
    }

    reportPending() {
        let interval_id: any;
        let update_keys = [...this.update_keys];
        let n = 0;

        const printPending = () => {
            msg.log(t`updateStatus` + ' ' + t`seconds ${++n}`);
            for (const update_key of [...update_keys]) {
                const pending_name = update_key + '_info_update_pending';
                const update = gettext(pending_name);
                const is_updated = !this.info_update_pending[update_key];
                msg.log('  ' + update + ': ' + ' '.repeat(45 - update.length)
                        + (is_updated ? t`finished` : t`pending`));
                if (is_updated) {
                    update_keys.splice(update_keys.indexOf(update_key), 1);
                }
            }

            if (!this.update_keys.map(key => this.info_update_pending[key]).some(value => value)) {
                msg.log(t`CodeInfoUpdateFinished ${this.project.folder}` + ' ' + new Date().toString());
                clearInterval(interval_id);
            }
        }

        interval_id = setInterval(printPending, 1000);
    }

    update() {
        this.project.validateConfigFileAndDo(file_data => {
            if (file_data.source_directories.length === 0) {
                this.setAllPending(false);
                return;
            }

            setTimeout(() => {
                this.updateFileTree(file_data.source_directories);
            }, 0);
            setTimeout(() => {
                this.updateYamlInfo(file_data.source_directories);
            }, 0);
            setTimeout(() => {
                this.updateBaseClassesInfo(file_data.source_directories);
            }, 0);
            setTimeout(() => {
                this.updateObjects(file_data.source_directories);
            }, 0);

            msg.log(t`CodeInfoUpdateStarted ${this.project.folder}` + ' ' + new Date().toString());
            this.reportPending();
        });
    }

    addSingleYamlInfo(file: string) {
        const yaml_data = { ...yaml.load(file), yaml_file: file };
        if (yaml_data.code) {
            const src = path.join(path.dirname(file), yaml_data.code);
            this.yaml_data_by_file[src] = yaml_data;
        }
        const class_name = yaml_data['class-name'];
        if (class_name) {
            this.yaml_data_by_class[class_name] = yaml_data;
        }

        const addObjectName = (type: string, name: string) => {
            if (!this.object_info[type][name]) {
                this.object_info[type][name] = { name };
            }
        };
        const types = {
            author: 'author',
            classes: 'class',
            functions: 'function',
            constants: 'constant',
            mappers: 'mapper',
            vmaps: 'value-map'
        };
        for (const key of Object.keys(types)) {
            for (const name of yaml_data[key] || []) {
                addObjectName(types[key], name);
            }
        }
        if (class_name) {
            addObjectName('class', class_name);
            if (yaml_data.desc) {
                this.object_info.class[class_name].desc = yaml_data.desc;
            }
        }
    }

    private updateYamlInfo(source_directories: string[]) {
        this.info_update_pending['yaml'] = true;
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
        this.info_update_pending['yaml'] = false;
    }

    private async updateBaseClassesInfo(source_directories: string[]) {
        this.info_update_pending['base_classes'] = true;
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
        this.info_update_pending['base_classes'] = false;
    }

    private addDescToBaseClasses(base_classes: string[], root_class: string, root_class_desc: string): any[] {
        let ret_val = [];
        for (const base_class of base_classes) {
            const desc = base_class === root_class
                ? root_class_desc
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

            let files = filesInDir(full_dir, isInterfaceClass);
            for (let file of files) {
                num_pending++;

                const file_content = fs.readFileSync(file);
                const buffer: Buffer = Buffer.from(file_content);
                const contents = buffer.toString();

                const doc: QoreTextDocument = {
                    uri: 'file:' + file,
                    text: contents,
                    languageId: 'qore',
                    version: 1
                };

                qore_vscode.exports.getDocumentSymbols(doc, 'node_info').then(symbols => {
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

    private updateFileTree(source_directories: string[]) {
        this.waitForPending(['file_tree']);
        this.info_update_pending['file_tree'] = true;
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

        let file_tree: any = dirItem(this.project.folder, false, true);
        let dir_tree: any = dirItem(this.project.folder, true, true);

        for (let dir of source_directories) {
            let file_tree_root = dirItem(path.join(this.project.folder, dir), false);
            file_tree.dirs.push(file_tree_root);
            subDirRecursion(file_tree_root, false);

            let dir_tree_root = dirItem(path.join(this.project.folder, dir), true);
            dir_tree.dirs.push(dir_tree_root);
            subDirRecursion(dir_tree_root, true);
        }

        this.file_tree = file_tree;
        this.dir_tree = dir_tree;
        this.info_update_pending['file_tree'] = false;
    }

    private updateObjects(source_directories: string[]) {
        this.info_update_pending['objects'] = true;
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

                this.info_update_pending['objects'] = true;
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
                        this.info_update_pending['objects'] = false;
                        child_process_failed = true;
                        return;
                    }

                    const objects: any[] = JSON.parse(stdout.toString());

                    for (let obj of objects) {
                        const authors = obj.tags.author || obj.tags.serviceauthor || [];
                        for (const author of authors) {
                            this.object_info.author[author] = { name: author };
                        }

                        obj.type = obj.type.replace(/ /g, '-');

                        if (!this.object_info_types.includes(obj.type)) {
                            continue;
                        }
                        if (obj.type === 'function' && obj.tags.type !== 'GENERIC') {
                            continue;
                        }

                        this.object_info[obj.type][obj.tags.name] = {
                            name: obj.tags.name,
                            desc: obj.tags.desc,
                        };
                    }
                    if (--num_pending == 0) {
                        this.info_update_pending['objects'] = false;
                    }
                });
            }
        }
    }
}
