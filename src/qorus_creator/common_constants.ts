export const supported_langs = ['qore', 'java'];

export const lang_suffix = {
    java: '.java',
    qore: '',
};

export const lang_comment_chars = {
    java: '//',
    qore: '#',
};

export const lang_inherits = {
    java: 'extends',
    qore: 'inherits',
};

export const default_parse_options = '\
%new-style\n\
%strict-args\n\
%require-types\n\
%enable-all-warnings\n\n\
';

const classTemplate = (with_base_class, with_methods) => {
    let class_template: any = {};

    supported_langs.forEach(lang => {
        class_template[lang] = 'class ${this.class_name}';
        if (with_base_class) {
            class_template[lang] += ` ${lang_inherits[lang]}` + ' ${this.base_class_name}';
        }
        class_template[lang] += ' {';
        if (with_methods) {
            class_template[lang] += '\n${this.methods}';
        }
        class_template[lang] += '\n${this.connections_within_class}}\n${this.connections_extra_class}';
    });

    return class_template;
};

export const class_template = classTemplate(false, false);
export const subclass_template = classTemplate(true, false);
export const class_with_methods_template = classTemplate(false, true);
export const subclass_with_methods_template = classTemplate(true, true);

export const classFields = ({ is_editing, default_target_dir }) => [
    field.targetDir(default_target_dir),
    field.targetFile,
    field.name,
    field.desc,
    field.author,
    field.version,
    field.class_name,
    field.lang(is_editing),
    {
        name: 'base-class-name',
        mandatory: false,
        type: 'select-string',
        get_message: {
            action: 'creator-get-objects',
            object_type: 'base-class',
        },
        return_message: {
            action: 'creator-return-objects',
            object_type: 'base-class',
            return_value: 'objects',
        },
        on_change: 'get-config-items',
        notify_on_remove: true,
    },
    {
        name: 'requires',
        mandatory: false,
        type: 'class-array',
        get_message: {
            action: 'creator-get-objects',
            object_type: 'class',
        },
        return_message: {
            action: 'creator-return-objects',
            object_type: 'class',
            return_value: 'objects',
        },
        on_change: 'get-config-items',
        notify_on_remove: true,
    },
    field.tags,
    {
        name: 'class-connectors',
        mandatory: false,
        type: 'class-connectors',
    },
];

export const field = {
    targetDir: default_target_dir => ({
        name: 'target_dir',
        type: 'file-string',
        default_value: default_target_dir,
        get_message: {
            action: 'creator-get-directories',
            object_type: 'target_dir',
        },
        return_message: {
            action: 'creator-return-directories',
            object_type: 'target_dir',
            return_value: 'directories',
        },
    }),
    targetFile: {
        name: 'target_file',
        mandatory: false,
    },
    name: {
        name: 'name',
    },
    desc: {
        name: 'desc',
        type: 'long-string',
        markdown: true,
    },
    author: {
        name: 'author',
        mandatory: false,
        type: 'select-array',
        get_message: {
            action: 'creator-get-objects',
            object_type: 'author',
        },
        return_message: {
            action: 'creator-return-objects',
            object_type: 'author',
            return_value: 'objects',
        },
    },
    version: {
        name: 'version',
    },
    class_name: {
        name: 'class-name',
        prefill: 'name',
        style: 'PascalCase',
    },
    lang: is_editing => ({
        name: 'lang',
        type: 'enum',
        items: [
            {
                value: 'qore',
                icon_filename: 'qore-106x128.png',
            },
            {
                value: 'java',
                icon_filename: 'java-96x128.png',
            },
        ],
        default_value: 'qore',
        disabled: is_editing,
    }),
    constants: {
        name: 'constants',
        mandatory: false,
        type: 'select-array',
        get_message: {
            action: 'creator-get-objects',
            object_type: 'constant',
        },
        return_message: {
            action: 'creator-return-objects',
            object_type: 'constant',
            return_value: 'objects',
        },
    },
    functions: {
        name: 'functions',
        mandatory: false,
        type: 'select-array',
        get_message: {
            action: 'creator-get-objects',
            object_type: 'function',
        },
        return_message: {
            action: 'creator-return-objects',
            object_type: 'function',
            return_value: 'objects',
        },
    },
    mapper: {
        name: 'mappers',
        mandatory: false,
        type: 'select-array',
        get_message: {
            action: 'creator-get-objects',
            object_type: 'mapper',
        },
        return_message: {
            action: 'creator-return-objects',
            object_type: 'mapper',
            return_value: 'objects',
        },
    },
    vmaps: {
        name: 'vmaps',
        mandatory: false,
        type: 'select-array',
        get_message: {
            action: 'creator-get-objects',
            object_type: 'value-map',
        },
        return_message: {
            action: 'creator-return-objects',
            object_type: 'value-map',
            return_value: 'objects',
        },
    },
    modules: {
        name: 'modules',
        mandatory: false,
        type: 'select-array',
        get_message: {
            action: 'creator-get-objects',
            object_type: 'module',
        },
        return_message: {
            action: 'creator-return-objects',
            object_type: 'module',
            return_value: 'objects',
        },
    },
    remote: {
        name: 'remote',
        mandatory: false,
        type: 'boolean',
        default_value: true,
    },
    groups: {
        name: 'groups',
        mandatory: false,
        type: 'select-array',
        get_message: {
            action: 'creator-get-objects',
            object_type: 'group',
        },
        return_message: {
            action: 'creator-return-objects',
            object_type: 'group',
            return_value: 'objects',
        },
    },
    tags: {
        name: 'tags',
        mandatory: false,
        type: 'array-of-pairs',
        fields: ['key', 'value'],
        get_message: {
            action: 'creator-get-objects',
            object_type: 'tag',
        },
        return_message: {
            action: 'creator-return-objects',
            object_type: 'tag',
            return_value: 'objects',
        },
    },
    classes: {
        name: 'classes',
        mandatory: false,
        type: 'class-array',
        get_message: {
            action: 'creator-get-objects',
            object_type: 'class',
        },
        return_message: {
            action: 'creator-return-objects',
            object_type: 'class',
            return_value: 'objects',
        },
        on_change: 'get-config-items',
        notify_on_remove: true,
    },
    workflow_options: {
        name: 'workflow_options',
        type: 'array-of-pairs',
        fields: ['key', 'value'],
        mandatory: false,
    },
    statuses: {
        name: 'statuses',
        type: 'array-of-pairs',
        fields: ['code', 'desc'],
        mandatory: false,
    },
    define_auth_label: {
        name: 'define-auth-label',
        type: 'array-of-pairs',
        fields: ['label', 'value'],
        mandatory: false,
    },
};
