import * as vscode from 'vscode';
import * as child_process from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import * as yaml from 'yamljs';
import { qore_vscode } from './qore_vscode';
import { QorusProject } from './QorusProject';
import { qorus_webview } from './QorusWebview';
import { filesInDir, canBeParsed, canDefineInterfaceBaseClass, suffixToIfaceKind } from './qorus_utils';
import { t, gettext } from 'ttag';
import * as msg from './qorus_message';
import { getSuffix } from './qorus_utils';

const object_parser_command = 'qop.q -i';
const object_chunk_length = 100;
const root_services = ['QorusService'];
const root_jobs = ['QorusJob'];
const root_workflows = ['QorusWorkflow'];
const root_steps = ['QorusAsyncStep', 'QorusEventStep', 'QorusNormalStep', 'QorusSubworkflowStep',
      'QorusAsyncArrayStep', 'QorusEventArrayStep', 'QorusNormalArrayStep', 'QorusSubworkflowArrayStep'];
const log_update_messages = false;
const object_info_types = ['author', 'class', 'function', 'constant', 'mapper', 'value-map'];
const info_keys = ['file_tree', 'yaml', 'base_classes', 'objects'];
const default_version = '1.0';

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
    private yaml_wf_class_data_by_name_version: any = {};
    private file_tree: any = {};
    private dir_tree: any = {};
    private inheritance_pairs: any = {};
    private code_info: any = {service: {}, job: {}};
    private service_classes = root_services;
    private job_classes = root_jobs;
    private workflow_classes = root_workflows;
    private step_classes = root_steps;

    private all_files_watcher: vscode.FileSystemWatcher;
    private yaml_files_watcher: vscode.FileSystemWatcher;
    private base_classes_files_watcher: vscode.FileSystemWatcher;
    private parsable_files_watcher: vscode.FileSystemWatcher;

    constructor(project: QorusProject) {
        this.project = project;
        this.initObjectInfo();
        this.initFileWatchers();
        this.update(undefined, true);
    }

    get yaml_info_by_file(): any {
        return this.yaml_data_by_file;
    }

    get yaml_info_by_class(): any {
        return this.yaml_data_by_class;
    }

    wfYamlInfoByFile(path: string): any {
        const class_yaml = this.yaml_data_by_file[path];
        if (!class_yaml.name) {
            return undefined;
        }
        const name_version = `${class_yaml.name}:${class_yaml.version || default_version}`;
        return this.yaml_wf_class_data_by_name_version[name_version];
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
        for (const type of object_info_types) {
            this.object_info[type] = {};
        }
    }

    private initFileWatchers() {
        this.all_files_watcher = vscode.workspace.createFileSystemWatcher('**/*');
        this.all_files_watcher.onDidCreate(() => this.update(['file_tree']));
        this.all_files_watcher.onDidDelete(() => this.update(['file_tree']));

        this.yaml_files_watcher = vscode.workspace.createFileSystemWatcher('**/*.yaml');
        this.yaml_files_watcher.onDidCreate((uri: vscode.Uri) => this.addSingleYamlInfo(uri.fsPath));
        this.yaml_files_watcher.onDidChange(() => this.update(['yaml']));
        this.yaml_files_watcher.onDidDelete(() => this.update(['yaml']));

        this.base_classes_files_watcher = vscode.workspace.createFileSystemWatcher('**/*.{qclass,qfd}');
        this.base_classes_files_watcher.onDidCreate(() => this.update(['base_classes']));
        this.base_classes_files_watcher.onDidChange(() => this.update(['base_classes']));
        this.base_classes_files_watcher.onDidDelete(() => this.update(['base_classes']));

        this.parsable_files_watcher
            = vscode.workspace.createFileSystemWatcher('**/*.{qfd,qsd,qjob,qclass,qconst,qmapper,qvmap,java}');
        this.parsable_files_watcher.onDidCreate(() => this.update(['objects']));
        this.parsable_files_watcher.onDidChange(() => this.update(['objects']));
        this.parsable_files_watcher.onDidDelete(() => this.update(['objects']));
    }

    private waitForPending(info_keys: string[], timeout: number = 30000): Promise<void> {
        let interval_id: any;
        const interval = 100;
        let n = timeout/interval;

        return new Promise((resolve, reject) => {
            const checkPending = () => {
                const pending_list = info_keys.filter(key => this.info_update_pending[key]);
                if (!pending_list.length || !--n) {
                    clearInterval(interval_id);
                    if (n > 0) {
                        resolve();
                    }
                    else {
                        const error = t`CodeInfoUpdateTimedOut`
                            + pending_list.map(key => gettext(key + '_info_update_pending')) .join(', ');
                        msg.error(error);
                        reject(error);
                    }
                }
            };

            interval_id = setInterval(checkPending, interval);
        });
    }

    getObjects(object_type: string) {
        const postMessage = (return_type: string, objects: any) => {
            qorus_webview.postMessage({
                action: 'creator-return-' + return_type,
                object_type,
                [return_type]: objects
            });
        }

        switch (object_type) {
            case 'workflow-step':
            case 'workflow-steps':
                postMessage('objects', [
                    {
                        name: 'step 1',
                        desc: 'step 1 desc',
                    },
                    {
                        name: 'step 2',
                        desc: 'step 2 desc',
                    }
                ]);
                break;
            case 'service-base-class':
                this.waitForPending(['base_classes']).then(() => postMessage('objects',
                    this.addDescToBaseClasses(this.service_classes, root_services)));
                break;
            case 'job-base-class':
                this.waitForPending(['base_classes']).then(() => postMessage('objects',
                    this.addDescToBaseClasses(this.job_classes, root_jobs)));
                break;
            case 'workflow-base-class':
                this.waitForPending(['base_classes']).then(() => postMessage('objects',
                    this.addDescToBaseClasses(this.workflow_classes, root_workflows)));
                break;
            case 'step-base-class':
                this.waitForPending(['base_classes']).then(() => postMessage('objects',
                    this.addDescToBaseClasses(this.step_classes, root_steps)));
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
                this.waitForPending(['objects', 'yaml']).then(() => postMessage('objects',
                    Object.keys(this.object_info[object_type]).map(key => this.object_info[object_type][key])));
                break;
            case 'resource':
            case 'text-resource':
            case 'bin-resource':
            case 'template':
                this.waitForPending(['file_tree']).then(() => postMessage('resources', this.file_tree));
                break;
            case 'target-dir':
                this.waitForPending(['file_tree']).then(() => postMessage('directories', this.dir_tree));
                break;
            default:
                msg.error(t`UnknownInterfaceProperty ${object_type}`);
        }
    }

    private setAllPending(pending: boolean = true) {
        for (const key of info_keys) {
            this.info_update_pending[key] = pending;
        }
    }

    private logUpdateMessage(info_key: string) {
        if (!log_update_messages) {
            return;
        }
        const pending_name = info_key + '_info_update_pending';
        const update = gettext(pending_name);
        const is_pending = this.info_update_pending[info_key];
        msg.log(update + ': ' + ' '.repeat(45 - update.length) + (is_pending ? t`pending` : t`finished`));
    }

    update(info_list: string[] = info_keys, is_initial_update: boolean = false) {
        this.project.validateConfigFileAndDo(file_data => {
            if (file_data.source_directories.length === 0) {
                this.setAllPending(false);
                return;
            }

            if (info_list.includes('file_tree')) {
                setTimeout(() => {
                    this.updateFileTree(file_data.source_directories);
                }, 0);
            }
            if (info_list.includes('yaml')) {
                setTimeout(() => {
                    this.updateYamlInfo(file_data.source_directories);
                }, 0);
            }
            if (info_list.includes('base_classes')) {
                setTimeout(() => {
                    this.updateBaseClassesInfo(file_data.source_directories);
                }, 0);
            }
            if (info_list.includes('objects')) {
                setTimeout(() => {
                    this.updateObjects(file_data.source_directories);
                }, 0);
            }

            if (is_initial_update) {
                msg.log(t`CodeInfoUpdateStarted ${this.project.folder}` + ' ' + new Date().toString());

                let interval_id: any;
                let sec = 0;
                const checkPending = () => {
                    if (log_update_messages) {
                        msg.log(t`seconds ${++sec}`);
                    }
                    if (!info_keys.map(key => this.info_update_pending[key]).some(value => value)) {
                        msg.log(t`CodeInfoUpdateFinished ${this.project.folder}` + ' ' + new Date().toString());
                        clearInterval(interval_id);
                    }
                }

                interval_id = setInterval(checkPending, 1000);
            }
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

        if (yaml_data.type === 'workflow' && yaml_data.class && yaml_data.class.split(/:/) < 3) {
            let [name, version] = yaml_data.class.split(/:/);
            const name_version = `${name}:${version || default_version}`;
            this.yaml_wf_class_data_by_name_version[name_version] = yaml_data;
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
        this.setPending('yaml', true);
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
        this.setPending('yaml', false);
    }

    private async updateBaseClassesInfo(source_directories: string[]) {
        this.setPending('base_classes', true);
        await this.makeInheritancePairs(source_directories);

        const baseClasses = (base_classes: string[], inheritance_pairs: any) => {
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

        baseClasses(this.service_classes, {...this.inheritance_pairs});
        baseClasses(this.job_classes, {...this.inheritance_pairs});
        baseClasses(this.workflow_classes, {...this.inheritance_pairs});
        baseClasses(this.step_classes, {...this.inheritance_pairs});
        this.setPending('base_classes', false);
    }

    private addDescToBaseClasses(base_classes: string[], root_classes: string[]): any[] {
        let ret_val = [];
        for (const base_class of base_classes) {
            const desc = root_classes.includes(base_class)
                ? gettext(`${base_class}Desc`)
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

            let files = filesInDir(full_dir, canDefineInterfaceBaseClass);
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

                qore_vscode.activate().then(() => {
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
                });
            }
        }

        let n = 500;
        while (num_pending && --n) {
            await new Promise(resolve => setTimeout(resolve, 200));
        }
    }

    private setPending(info_key: string, value: boolean) {
        const doSetPending = () => {
            this.info_update_pending[info_key] = value;
            this.logUpdateMessage(info_key);
        }

        if (value && this.info_update_pending[info_key]) {
            this.waitForPending([info_key]).then(doSetPending);
        }
        else {
            doSetPending();
        }
    }

    private updateFileTree(source_directories: string[]) {
        this.setPending('file_tree', true);
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
        this.setPending('file_tree', false);
    }

    private updateObjects(source_directories: string[]) {
        this.setPending('objects', true);
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

                        if (!object_info_types.includes(obj.type)) {
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
                        this.setPending('objects', false);
                    }
                });
            }
        }
    }
}
