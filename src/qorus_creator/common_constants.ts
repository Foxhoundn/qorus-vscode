export const lang_suffix = {
    java: '.java',
    qore: '',
};

export const comment_chars = {
    java: '//',
    qore: '#',
};


export const default_parse_options = '\
%new-style\n\
%strict-args\n\
%require-types\n\
%enable-all-warnings\n\n\
';


export const class_template = {
    qore: 'class ${this.class_name} {\n}\n',
    java: 'class ${this.class_name} {\n}\n',
};


export const subclass_template = {
    qore: 'class ${this.class_name} inherits ${this.base_class_name} {\n}\n',
    java: 'class ${this.class_name} extends ${this.base_class_name} {\n}\n',
};


export const basicFields = params => [
    {
        name: 'target_dir',
        type: 'file-string',
        default_value: params.default_target_dir,
        get_message: {
            action: 'creator-get-directories',
            object_type: 'target_dir',
        },
        return_message: {
            action: 'creator-return-directories',
            object_type: 'target_dir',
            return_value: 'directories',
        },
    },
    {
        name: 'target_file',
        mandatory: false,
    },
    {
        name: 'name',
    },
    {
        name: 'version',
    },
    {
        name: 'desc',
    },
    {
        name: 'class-name',
        prefill: 'name',
        style: 'PascalCase',
    },
    {
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
];

export const classFields = params => [
    ... basicFields(params),
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
        on_change: 'get-config-items'
    }
];

export const commonFields = ({is_editing, ...other_params}) => [
    ... basicFields(other_params),
    {
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
    {
        name: 'remote',
        mandatory: false,
        type: 'boolean',
        default_value: true,
    },
    {
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
    },
    {
        name: 'classes',
        mandatory: false,
        type: 'select-array',
        get_message: {
            action: 'creator-get-objects',
            object_type: 'class',
        },
        return_message: {
            action: 'creator-return-objects',
            object_type: 'class',
            return_value: 'objects',
        },
    },
    {
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
    {
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
    {
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
    {
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
    {
        name: 'groups',
        mandatory: false,
        type: 'array-of-pairs',
        fields: ['name', 'desc'],
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
    {
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
];
