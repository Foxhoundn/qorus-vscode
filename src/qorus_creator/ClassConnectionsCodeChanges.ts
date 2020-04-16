import * as fs from 'fs';
import { QorusProjectEditInfo } from '../QorusProjectEditInfo';
import * as msg from '../qorus_message';

export const classConnectionsCodeChanges = (file, edit_info: QorusProjectEditInfo, data, orig_data) => {
    edit_info.addFileInfo(file, orig_data);

    if (orig_data['class-connections'] && !Object.keys(data['class-connections'] || {}).length) {
        removeClassConnectionsCode(file, edit_info.getInfo(file));
    }
};

const removeClassConnectionsCode = (file, edit_data) => {
    msg.debug({file, edit_data});
    const {
        text_lines,
        class_connections_class_loc,
        class_connections_member_declaration_loc,
        class_connections_member_initialization_loc,
        trigger_statement_locs
    } = edit_data;

    const locs = [
        class_connections_class_loc,
        class_connections_member_declaration_loc,
        class_connections_member_initialization_loc,
        ... trigger_statement_locs
    ];

    let lines = [...text_lines];
    lines = removeRanges(lines, locs);
    msg.debug({lines});
    fs.writeFileSync(file, lines.join('\n') + '\n');
};

const removeRanges = (lines, locs) => {
    const sorted_locs = sortLocs(locs).reverse();
    sorted_locs.forEach(loc => {
        lines = removeRange(lines, loc);
    });

    return lines;
};

const removeRange = (orig_lines, loc) => {
    let lines = [];

    for (let i = 0; i < loc.start_line - 1; i++) {
        lines.push(orig_lines[i]);
    }
    if (loc.start_line === loc.end_line) {
        let line = orig_lines[loc.start_line - 1];
        line = line.substr(0, loc.start_column - 1) + line.substr(loc.end_column);
        if (line.match(/\S/)) {
            lines.push(line);
        }
    } else {
        let line_a = orig_lines[loc.start_line - 1];
        let line_b = orig_lines[loc.end_line - 1];
        line_a = line_a.substr(0, loc.start_column - 1);
        line_b = line_b.substr(loc.end_column);
        [line_a, line_b].forEach(line => {
            if (line.match(/\S/)) {
                lines.push(line);
            }
        });
    }
    for (let i = loc.end_line; i < orig_lines.length; i++) {
        lines.push(orig_lines[i]);
    }

    return lines;
};

const sortLocs = locs => locs.sort((a, b) => {
    if (a.start_line < b.start_line) {
        return -1;
    }
    if (a.start_line > b.start_line) {
        return 1;
    }
    if (a.start_column < b.start_column) {
        return -1;
    }
    if (a.start_column > b.start_column) {
        return 1;
    }
    return 0;
});
