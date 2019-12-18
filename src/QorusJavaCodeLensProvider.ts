import { CodeLens, EndOfLine, Range, TextDocument } from 'vscode';
import { QorusCodeLensProviderBase } from './QorusCodeLensProvider';
import { makeFileUri } from './qorus_utils';
import { getJavaDocumentSymbolsWithWait } from './vscode_java';

export class QorusJavaCodeLensProvider extends QorusCodeLensProviderBase {
    //! Parse inheritance of class and add the info to symbol.
    private parseInheritance(document: TextDocument, symbol) {
        // find end of inheritance section (beginning of class block)
        const begin = symbol.selectionRange.end;
        let endChar = -1;
        let endLine = -1;
        for (let i = begin.line; i < document.lineCount; ++i) {
            let line = document.lineAt(i);
            if (line.isEmptyOrWhitespace) {
                continue;
            }
            endChar = line.text.indexOf('{');
            if (endChar !== -1) {
                endLine = i;
                break;
            }
        }
        if (endLine === -1) {
            return;
        }

        // get needed parts of text document
        const inheritanceRange = new Range(begin.line, 0, endLine, endChar);
        const origText = document.getText(inheritanceRange);
        const text = origText.substr(begin.character).replace(/(\n|\r)/, '');

        // split the text into clean words (get rid of whitespace and commas)
        let words = text.split(/\s+/);
        let i = 0;
        while (i < words.length) {
            let word = words[i];
            if (!word.length || word === ',') {
                words.splice(i, 1);
                continue;
            }

            let splitted = word.split(',');
            for (let s = 0; s < splitted.length;) {
                if (!splitted[s].length) {
                    splitted.splice(s, 1);
                    continue;
                }
                ++s;
            }

            if (splitted.length) {
                words.splice(i++, 1, splitted.shift());
                while (splitted.length) {
                    words.splice(i++, 0, splitted.shift());
                }
            } else {
                ++i;
            }
        }
        if (words.length < 2) {
            return;
        }

        // parse base class and interfaces
        let baseClass;
        while (words.length) {
            if (words[0] === 'extends' && words.length > 1) {
                baseClass = words[1];
                words.splice(0, 2);
            }
            else if (words[0] === 'implements' && words.length > 1) {
                words.splice(0, 1);
                if (!symbol.implements) {
                    symbol.implements = [];
                }
                while (words.length && words[0] !== 'extends') {
                    symbol.implements.push(words[0]);
                    words.splice(0, 1);
                }
            }
            else {
                break;
            }
        }

        // find base class range
        if (baseClass !== undefined) {
            let re = new RegExp("\\sextends\\s+" + baseClass);
            let matches = origText.match(re);
            if (!matches) {
                return;
            }
            let extendsPos = origText.indexOf(matches[0]);
            let firstChar = origText.indexOf(baseClass, extendsPos);

            let eol = (document.eol === EndOfLine.LF)
                ? '\n'
                : '\r\n';
            let line = begin.line;
            let newLinePos = origText.indexOf(eol);
            let lastNewLinePos = 0;
            while (newLinePos !== -1) {
                ++line;
                lastNewLinePos = newLinePos;
                newLinePos = origText.indexOf(eol, newLinePos + 1);
            }
            if (lastNewLinePos) {
                firstChar -= lastNewLinePos + eol.length;
            }

            //++line; // needed in case positions should be starting from 1
            //++firstChar; // needed in case positions should be starting from 1

            // set the symbol extends property
            symbol.extends = {
                name: baseClass,
                range: {
                    start: {
                        line: line,
                        character: firstChar
                    },
                    end: {
                        line: line,
                        character: firstChar + baseClass.length
                    }
                }
            };
        }
    }

    protected async provideLanguageSpecificImpl(document: TextDocument, file_path: string, iface_kind: string, data: any): Promise<CodeLens[]> {
        return getJavaDocumentSymbolsWithWait(makeFileUri(file_path)).then(symbols => {
            if (!symbols || !symbols.length) {
                return this.previous_lenses;
            }
            let lenses: CodeLens[] = [];

            symbols.forEach(symbol => {
                if (!this.code_info.isJavaSymbolExpectedClass(symbol, data['class-name'])) {
                    return;
                }

                this.parseInheritance(document, symbol);
                this.code_info.addJavaClassCodeInfo(file_path, symbol, data['base-class-name'], false);
                this.addClassLenses(iface_kind, lenses, symbol, data);

                if (!['service', 'mapper-code'].includes(iface_kind)) {
                    return;
                }

                for (let child of symbol.children || []) {
                    if (!this.code_info.addJavaClassDeclCodeInfo(file_path, child)) {
                        continue;
                    }
                    this.addMethodLenses(
                        iface_kind, lenses, child.range, data,
                        child.name.replace(/\(.*\)/, ''), symbol.name
                    );
                }
            });

            this.previous_lenses = lenses;
            return lenses;
        });
    }
}
