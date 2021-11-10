// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
const vscode = require('vscode');
const bml = require('bml');

// this method is called when your extension is activated
// your extension is activated the very first time the command is executed

/**
 * @param {vscode.ExtensionContext} context
 */
function activate(context) {
    let bmlOutput;

	// The command has been defined in the package.json file
	// Now provide the implementation of the command with  registerCommand
	// The commandId parameter must match the command field in package.json
	let disposable = vscode.commands.registerCommand('extension.runBml', () => {
        if (!bmlOutput) {
            bmlOutput = vscode.window.createOutputChannel("BML");
        }
        bmlOutput.show(true);

        let doc = vscode.window.activeTextEditor.document;

        bmlOutput.appendLine(`> Running BML on '${doc.fileName}' with renderSettings {}`)

        let result = bml(doc.getText());

        bmlOutput.append(result);
	});

	context.subscriptions.push(disposable);
}

// this method is called when your extension is deactivated
function deactivate() {}

// eslint-disable-next-line no-undef
module.exports = {
	activate,
	deactivate
}