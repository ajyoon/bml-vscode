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
    context.subscriptions.push(
        vscode.commands.registerTextEditorCommand('extension.referenceSelectedFork', referenceSelectedFork));
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

function referenceSelectedFork(editor, edit, args) {
    let selection = editor.selection;
    let selectedText = editor.document.getText(selection);
    if (selectedText[0] !== '{' || selectedText[selectedText.length - 1] !== '}') {
        return;
    }
    let idRe = /^{([#$]*)(.+?):/;
    let idMatch = selectedText.match(idRe);
    if (!idMatch) {
        return;
    }
    let originalPrefix = idMatch[1];
    let wasSilent = originalPrefix.includes('#');
    let prefix = wasSilent ? '#' : '';
    let id = idMatch[2];
    let output = '';
    let branchIdx = 0;
    for (let i = 0; i < selectedText.length; i++) {
        if (selectedText[i] === '(') {
            output += branchIdx + ' -> (';
            branchIdx++;
        } else {
            output += selectedText[i];
        }
    }
    output = output.replace(originalPrefix, '@')
    output = `{${prefix}${id}2: ${output}}`;
    edit.insert(selection.end, '\n' + output);
    // Replace the selection with the dummy "2" for easy replacement
    // disabled ATM because I couldn't get it to work
    // let offset = output.indexOf('2');
    // let selectionStart = selection.end.translate(0, offset);
    // let selectionEnd = selectionStart.translate(0, 1);
    // console.log(offset, selectionStart, selectionEnd);
    // editor.selection = new vscode.Selection(selectionStart, selectionEnd);
}

// this method is called when your extension is deactivated
function deactivate() { }

// eslint-disable-next-line no-undef
module.exports = {
    activate,
    deactivate
}