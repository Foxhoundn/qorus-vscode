import { toValidIdentifier } from '../qorus_utils';

export const connectionsCode = (data, lang) => {
    const {connections_inside, triggers} = insideConnectionsCode(data, lang);
    const {connections_outside} = outsideConnectionsCode(data, lang);
    return {connections_inside, connections_outside, triggers};
}

// =================================================================

const insideConnectionsCode = (data, lang) => {
    let triggers = [];
    let code = fillTemplate(constructor_template[lang]);

    let trigger_exists = false;
    for (const connection in data) {
        for (const connector of data[connection]) {
            if (connector.trigger) {
                if (!trigger_exists) {
                    code += `${indent}${generated.qore.begin}\n`;
                    trigger_exists = true;
                } else {
                    code += '\n';
                }

                code += fillTemplate(trigger_template[lang], {
                    connection: toValidIdentifier(connection),
                    trigger: toValidIdentifier(connector.trigger)
                });

                triggers.push(connector.trigger);
            }
        }
    }
    if (trigger_exists) {
        code += `${indent}${generated.qore.end}\n`;
    }

    return { triggers, connections_inside: code };
};

// =================================================================

const outsideConnectionsCode = (_data, _lang) => {
    let code = '';

    return { connections_outside: code };
};

// =================================================================

const fillTemplate = (template: any, vars?: any): string =>
    new Function('return `' + template + '`;').call(vars);

const indent = '    ';
const indent2 = indent + indent;

let generated: any = { qore: {}, java: {} };
generated.qore.begin = '####### GENERATED SECTION! DON\'T EDIT! ########'
generated.qore.end   = '############ GENERATED SECTION END ############'
generated.java.begin = '// ==== GENERATED SECTION! DON\'T EDIT! ==== //';
generated.java.end   = '// ======== GENERATED SECTION END ========= //';

// =================================================================

let constructor_template: any = {};
constructor_template.qore = '\
    private {\n' +
        `${indent2}${generated.qore.begin}` + '\n\
        ClassConnections class_connections;\n' +
        `${indent2}${generated.qore.end}` + '\n\
    }\n\
\n\
    constructor() {\n' +
        `${indent2}${generated.qore.begin}` + '\n\
        class_connections = new ClassConnections();\n' +
        `${indent2}${generated.qore.end}` + '\n\
    }\n\
\n\
';

// =================================================================

let trigger_template: any = {};
trigger_template.qore = '\
    ${this.trigger}() {\n\
        class_connections.${this.connection}();\n\
    }\n\
';

// =================================================================
