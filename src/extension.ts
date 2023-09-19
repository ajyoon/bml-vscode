// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code beloAexport w
import * as vscode from 'vscode';
// @ts-ignore
import * as bml from 'bml';

// This method is called when your extension is activated
// Your extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext) {
	let bmlOutput: vscode.OutputChannel;

	// The command has been defined in the package.json file
	// Now provide the implementation of the command with  registerCommand
	// The commandId parameter must match the command field in package.json
	vscode.commands.registerTextEditorCommand('bml-vscode.runBml', () => {
		if (!bmlOutput) {
			bmlOutput = vscode.window.createOutputChannel("BML");
		}
		bmlOutput.show(true);

		let doc = vscode.window.activeTextEditor!.document;

		bmlOutput.appendLine(`> Running BML on '${doc.fileName}' with renderSettings {}`);

		let result = bml(doc.getText());

		bmlOutput.append(result);
	});

	vscode.commands.registerTextEditorCommand('bml-vscode.createInlineChoice', createInlineChoice);
	vscode.commands.registerTextEditorCommand('bml-vscode.referenceSelectedFork', referenceSelectedFork);
	vscode.commands.registerTextEditorCommand('bml-vscode.nextBranch', nextBranch);
}

function createInlineChoice(editor: vscode.TextEditor, edit: vscode.TextEditorEdit, args: any[]) {
	let snippet;
	if (editor.selection.isEmpty) {
		snippet = new vscode.SnippetString(`{($1), ($0)}`);
	} else {
		snippet = new vscode.SnippetString(`{($TM_SELECTED_TEXT), ($0)}`);
	}
	editor.insertSnippet(snippet);
}

function referenceSelectedFork(editor: vscode.TextEditor, edit: vscode.TextEditorEdit, args: any[]) {
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
	output = output.replace(originalPrefix, '@');
	output = `{${prefix}${id}2: ${output}}`;
	// edit.insert(selection.end, '\n' + output);
	// Replace the selection with the dummy "2" for easy replacement
	// disabled ATM because I couldn't get it to work
	// let offset = output.indexOf('2');
	// let selectionStart = selection.end.translate(0, offset);
	// let selectionEnd = selectionStart.translate(0, 1);
	// console.log(offset, selectionStart, selectionEnd);
	// editor.selection = new vscode.Selection(selectionStart, selectionEnd);
	editor.edit((editBuilder) => {
		editBuilder.insert(selection.end, '\n' + output);
	}).then(success => {
		if (success) {
			let offset = output.indexOf('2');
			let selectionStart = selection.end.translate(1, 0).with(undefined, offset);
			let selectionEnd = selectionStart.translate(0, 1);
			// This doesn't seem to gel with VSCodeVim, but it seems it may not be avoidable
			// https://github.com/VSCodeVim/Vim/issues/1806
			editor.selection = new vscode.Selection(selectionStart, selectionEnd);
		}
	});
}

function findNextMatchingChar(editor: vscode.TextEditor, character: string): vscode.Position | null {
	const document = editor.document;
	const cursorPosition = editor.selection.active;

	for (let lineIdx = cursorPosition.line; lineIdx < document.lineCount; lineIdx++) {
		const lineText = document.lineAt(lineIdx).text;
		const startCharacter = (lineIdx === cursorPosition.line) ? cursorPosition.character : 0;

		for (let charIdx = startCharacter; charIdx < lineText.length; charIdx++) {
			if (lineText[charIdx] === character) {
				return new vscode.Position(lineIdx, charIdx);
			}
		}
	}
	return null;
}

function nextBranch(editor: vscode.TextEditor, edit: vscode.TextEditorEdit, args: any[]) {
	let closeParenPos = findNextMatchingChar(editor, ')');
	if (closeParenPos === null) {
		vscode.window.showInformationMessage("Can't find end of branch");
		return;
	}
	// For now, just insert a new branch.
	// Later on this can be extended to search for a next branch and seek to it if found
	editor.edit((editBuilder) => {
		editBuilder.insert(closeParenPos!.translate(0, 1), ', ()');
	}).then(success => {
		if (success) {
			let cursorPos = closeParenPos!.translate(0, 4);
			editor.selection = new vscode.Selection(cursorPos, cursorPos);
		}
	});
}

// this method is called when your extension is deactivated
export function deactivate() { }

