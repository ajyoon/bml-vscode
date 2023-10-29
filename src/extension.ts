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

	let renameProvider = new BMLRenameProvider();
	context.subscriptions.push(vscode.languages.registerRenameProvider(
		{ language: 'bml', scheme: 'file' }, renameProvider));
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

const ID_RE = /{([#$@!]*)([_a-zA-Z\xA0-\uFFFF][_a-zA-Z0-9\xA0-\uFFFF]+)[:}]/;
const ID_RE_FULL_STRING = /^{([#$@!]*)([_a-zA-Z\xA0-\uFFFF][_a-zA-Z0-9\xA0-\uFFFF]+)[:}]$/;

function referenceSelectedFork(editor: vscode.TextEditor, edit: vscode.TextEditorEdit, args: any[]) {
	let selection = editor.selection;
	let selectedText = editor.document.getText(selection);
	if (selectedText[0] !== '{' || selectedText[selectedText.length - 1] !== '}') {
		return;
	}
	let idMatch = selectedText.match(ID_RE);
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

function charAtPos(document: vscode.TextDocument, position: vscode.Position): string {
	const range = new vscode.Range(position, position.translate(0, 1));
	return document.getText(range);
}

function findNearestOpenBraceBeforePosition(document: vscode.TextDocument, position: vscode.Position): vscode.Position | null {
	while (position.line > 0 || position.character >= 0) {
		let char = charAtPos(document, position);
		if (char === '{') {
			return position;
		} else if (char === ' ') {
			// Rough optimization check - whitespace means no match
			return null;
		}
		position = position.translate(0, -1);
	}
	// No open brace found before `position`
	return null;
}

function findNearestColonOrCloseBraceAfterPosition(document: vscode.TextDocument, position: vscode.Position): vscode.Position | null {
	let docEnd = document.lineAt(document.lineCount - 1).range.end;
	while (position.isBefore(docEnd)) {
		let char = charAtPos(document, position);
		if (char === ':' || char === '}') {
			return position.translate(0, 1);
		} else if (char === ' ') {
			// Rough optimization check - whitespace means no match
			return null;
		}
		position = position.translate(0, 1);
	}
	// No colon found after `position`
	return null;
}

function selectRefId(document: vscode.TextDocument, position: vscode.Position): [string, vscode.Range] | null {
	let startPos = findNearestOpenBraceBeforePosition(document, position);
	if (startPos === null) {
		return null;
	}
	let endPos = findNearestColonOrCloseBraceAfterPosition(document, position);
	if (endPos === null) {
		return null;
	}
	let text = document.getText(new vscode.Range(startPos, endPos));
	let idMatch = text.match(ID_RE_FULL_STRING);
	if (!idMatch) {
		return null;
	}
	let id = idMatch[2];
	endPos = endPos.translate(0, -1); // Trim colon
	startPos = endPos.translate(0, -id.length); // Trim left-side declaration chars
	return [
		id, new vscode.Range(startPos, endPos)
	];
}

/*
Basic functionality for renaming references within the open file. This assumes
there is no whitespace or comments between the ID and its preceding or following
expected tokens (braces, !@#$, or colon). This also assumes IDs are not bound
multiple times, as it simply finds the ID at the cursor and replaces all
apparent occurrences of that ID in the document.
*/
class BMLRenameProvider implements vscode.RenameProvider {

	async prepareRename(document: vscode.TextDocument, position: vscode.Position, token: vscode.CancellationToken): Promise<vscode.Range | { placeholder: string, range: vscode.Range }> {
		let selectRefResult = selectRefId(document, position);
		if (selectRefResult === null) {
			return Promise.reject();
		}
		let [id, replaceRange] = selectRefResult;
		return { placeholder: id, range: replaceRange };
	}

	async provideRenameEdits(document: vscode.TextDocument, position: vscode.Position, newName: string, token: vscode.CancellationToken): Promise<vscode.WorkspaceEdit | undefined> {
		const workspaceEdit = new vscode.WorkspaceEdit();
		const ranges: vscode.Range[] = [];

		let selectRefResult = selectRefId(document, position);
		if (selectRefResult === null) {
			return Promise.reject();
		}
		const [id, _] = selectRefResult;
		const renameRE = new RegExp(`{([#$@!]*)(${id})[:}]`, "g");
		for (let i = 0; i < document.lineCount; i++) {
			let line = document.lineAt(i).text;
			for (let match of line.matchAll(renameRE)) {
				let endPos = new vscode.Position(i, match.index! + match[0].length - 1);
				let startPos = endPos.translate(0, -match[2].length);
				ranges.push(new vscode.Range(startPos, endPos));
			}
		}

		for (const range of ranges) {
			workspaceEdit.replace(document.uri, range, newName);
		}
		return workspaceEdit;
	}
}

// this method is called when your extension is deactivated
export function deactivate() { }

