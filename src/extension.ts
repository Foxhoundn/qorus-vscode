import * as vscode from 'vscode';
import * as child_process from 'child_process';
import { projects, config_filename } from './QorusProject';
import { InterfaceInfo } from './qorus_creator/InterfaceInfo';
import { QorusExtension } from './qorus_vscode';
import { qorus_request } from './QorusRequest';
import { qorus_webview } from './QorusWebview';
import { qorus_locale } from './QorusLocale';
import { deployer } from './QorusDeploy';
import { tester } from './QorusTest';
import { tree } from './QorusTree';
import { QorusCodeLensProvider } from './QorusCodeLensProvider';
import { QorusHoverProvider } from './QorusHoverProvider';
import { creator } from './qorus_creator/InterfaceCreatorDispatcher';
import * as msg from './qorus_message';
import { t } from 'ttag';

qorus_locale.setLocale();

export async function activate(context: vscode.ExtensionContext) {
    QorusExtension.context = context;

    let disposable = vscode.commands.registerTextEditorCommand('qorus.deployCurrentFile',
                                                               () => deployer.deployCurrentFile());
    context.subscriptions.push(disposable);

    disposable = vscode.commands.registerCommand('qorus.deployFile', (uri: vscode.Uri) => deployer.deployFile(uri));
    context.subscriptions.push(disposable);

    disposable = vscode.commands.registerCommand('qorus.deployDir', (uri: vscode.Uri) => deployer.deployDir(uri));
    context.subscriptions.push(disposable);

    disposable = vscode.commands.registerTextEditorCommand('qorus.testCurrentFile', () => tester.testCurrentFile());

    disposable = vscode.commands.registerCommand('qorus.testFile', (uri: vscode.Uri) => tester.testFile(uri));
    context.subscriptions.push(disposable);

    context.subscriptions.push(disposable);

    disposable = vscode.commands.registerCommand('qorus.testDir', (uri: vscode.Uri) => tester.testDir(uri));

    context.subscriptions.push(disposable);

    disposable = vscode.commands.registerCommand('qorus.setActiveInstance',
                                                 (tree_item: string | vscode.TreeItem) =>
                                                        qorus_request.setActiveInstance(tree_item));
    context.subscriptions.push(disposable);

    disposable = vscode.commands.registerCommand('qorus.loginAndSetActiveInstance',
                                                 (tree_item: vscode.TreeItem) =>
                                                        qorus_request.setActiveInstance(tree_item));
    context.subscriptions.push(disposable);

    disposable = vscode.commands.registerCommand('qorus.logout',
                                                 (tree_item: vscode.TreeItem) => qorus_request.logout(tree_item));
    context.subscriptions.push(disposable);

    disposable = vscode.commands.registerCommand('qorus.loginAndStayInactiveInstance',
                                                 (tree_item: vscode.TreeItem) => qorus_request.login(tree_item, false));
    context.subscriptions.push(disposable);

    disposable = vscode.commands.registerCommand('qorus.setInactiveInstanceStayLoggedIn',
                                                 (tree_item: vscode.TreeItem) =>
                                                        qorus_request.unsetActiveInstance(tree_item));
    context.subscriptions.push(disposable);

    disposable = vscode.commands.registerCommand('qorus.setInactiveInstance',
                                                 (tree_item: vscode.TreeItem) =>
                                                        qorus_request.unsetActiveInstance(tree_item));
    context.subscriptions.push(disposable);

    disposable = vscode.commands.registerCommand('qorus.openUrlInExternalBrowser', openUrlInExternalBrowser);
    context.subscriptions.push(disposable);

    disposable = vscode.commands.registerCommand('qorus.webview', () => qorus_webview.open());
    context.subscriptions.push(disposable);

    ['service', 'job', 'workflow', 'step', 'class', 'other'].forEach(subtab => {
        const command = 'qorus.create' + subtab[0].toUpperCase() + subtab.substr(1);
        disposable = vscode.commands.registerCommand(command, (uri: vscode.Uri) => qorus_webview.open({
            tab: 'CreateInterface', subtab, uri
        }));
        context.subscriptions.push(disposable);
    });

    disposable = vscode.commands.registerCommand('qorus.editInterface',
                                                 (data: any, iface_kind: string) =>
    {
        const code_info: InterfaceInfo = projects.currentInterfaceInfo();
        const iface_id = code_info.addIfaceById(data);
        qorus_webview.open({
            tab: 'CreateInterface',
            subtab: iface_kind,
            [iface_kind]: { ...data, iface_id }
        })
    });
    context.subscriptions.push(disposable);

    disposable = vscode.commands.registerCommand('qorus.deleteServiceMethod',
                                                 (data: any) => creator.deleteServiceMethod(data));
    context.subscriptions.push(disposable);

    disposable = vscode.window.registerTreeDataProvider('qorusInstancesExplorer', tree);
    context.subscriptions.push(disposable);

    disposable = vscode.languages.registerCodeLensProvider(
        [{ language: 'qore', scheme: 'file' }],
        new QorusCodeLensProvider()
    );
    context.subscriptions.push(disposable);

    disposable = vscode.languages.registerHoverProvider(
        [{ language: 'qore', scheme: 'file' }],
        new QorusHoverProvider()
    );
    context.subscriptions.push(disposable);

    updateQorusTree();

    vscode.window.onDidChangeActiveTextEditor(
        editor => {
            if (editor && editor.document && editor.document.uri.scheme === 'file') {
                updateQorusTree(editor.document.uri, false);
            }
        },
        null,
        context.subscriptions
    );

    vscode.workspace.onDidSaveTextDocument(
        document => {
            if (document.fileName.indexOf(config_filename) > -1) {
                updateQorusTree(document.uri);
            }
        },
        null,
        context.subscriptions
    );
}

export function deactivate() {}

function updateQorusTree(uri?: vscode.Uri, forceTreeReset: boolean = true) {
    const workspace_folder_changed_or_unset = projects.updateCurrentWorkspaceFolder(uri);

    if (workspace_folder_changed_or_unset || forceTreeReset) {
        projects.validateConfigFileAndDo(
            (file_data: any) => tree.reset(file_data.qorus_instances),
            () => tree.reset({}),
            uri
        );
    }

    if (workspace_folder_changed_or_unset) {
        if (qorus_webview.dispose()) {
            msg.warning(t`WorkspaceFolderChangedOrUnsetCloseWebview`);
        }
    }
}

function openUrlInExternalBrowser(url: string, name: string) {
    let cfg_name: string;
    switch (process.platform) {
        case 'aix':
        case 'freebsd':
        case 'linux':
        case 'openbsd':
        case 'sunos':
            cfg_name = 'openUrlInExternalBrowser.linux';
            break;
        case 'darwin':
            cfg_name = 'openUrlInExternalBrowser.mac';
            break;
        case 'win32':
            cfg_name = 'openUrlInExternalBrowser.windows';
            break;
        default:
            cfg_name = '';
    }
    const command: string = vscode.workspace.getConfiguration('qorus').get(cfg_name) + ' "' + url + '"';
    msg.info(t`OpeningUrlInExternalBrowser ${name} ${url}`);
    msg.log(command);
    try {
        child_process.execSync(command);
    } catch (error) {
        msg.error(t`OpenUrlInExternalBrowserError`);
    }
}
