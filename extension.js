// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
const vscode = require('vscode');
const bml = require('bml');

/**
 * @param {vscode.ExtensionContext} context
 */
function activate(context) {
    let bmlOutput;

    // The command has been defined in the package.json file
    // Now provide the implementation of the command with  registerCommand
    // The commandId parameter must match the command field in package.json
    context.subscriptions.push(vscode.commands.registerCommand('extension.runBml', () => {
        if (!bmlOutput) {
            bmlOutput = vscode.window.createOutputChannel("BML");
        }
        bmlOutput.show(true);

        let doc = vscode.window.activeTextEditor.document;

        bmlOutput.appendLine(`> Running BML on '${doc.fileName}' with renderSettings {}`)

        let result = bml(doc.getText());

        bmlOutput.append(result);
    }));

    context.subscriptions.push(
        vscode.commands.registerTextEditorCommand('extension.createInlineChoice', createInlineChoice));
}

function createInlineChoice(editor, edit, args) {
    let snippet;
    if (editor.selection.isEmpty) {
        snippet = new vscode.SnippetString(`{($1), ($0)}`);
    } else {
        snippet = new vscode.SnippetString(`{($TM_SELECTED_TEXT), ($0)}`);
    }
    editor.insertSnippet(snippet);
}

// this method is called when your extension is deactivated
function deactivate() { }

// eslint-disable-next-line no-undef
module.exports = {
    activate,
    deactivate
}