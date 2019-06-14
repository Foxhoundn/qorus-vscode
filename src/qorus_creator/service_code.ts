import * as os from 'os';
// import { SQLAuthorLen, SQLDescLen, SQLVersionLen, SQLNameLen, SQLPatchLen } from './creator_common';


let template: any = {};

template.qore =
"\
class ${this.class_name} inherits ${this.base_class_name} {\n\
    init() {\n\
    }\n\
}\n\
";

template.java =
"\
class ${this.class_name} extends ${this.base_class_name} {\n\
    public void init() {\n\
    }\n\
}\n\
";

export const service_template = template;


export const defaultServiceHeaders = data => {
    switch (data.lang) {
        case 'java': return {
            'class-name': data.class_name,
        };
        default: return {
            'class-based': true,
            'class-name': data.class_name,
            'parse-options': ['PO_NEW_STYLE', 'PO_STRICT_ARGS', 'PO_REQUIRE_TYPES'],
        };
    }
};


export const service_fields = {
    target_dir: {
        get_message: {
            action: 'get-opening-path',
        },
        return_message: {
            action: 'return-opening-path',
            return_value: 'path'
        }
    },
    target_file: {
    },
    class_name: {
        prefill: 'service',
        style: 'PascalCase'
    },
    base_class_name: {
        type: 'select-string',
        get_message: {
            action: 'creator-get-objects',
            object_type: 'base-class'
        },
        return_message: {
            action: 'creator-return-objects',
            object_type: 'base-class',
            return_value: 'objects'
        }
    },
    lang: {
        type: 'enum',
        values: ['qore', 'java'],
        default_value: 'qore'
    },
    service: {
    },
    serviceversion: {
    },
    servicedesc: {
    },
    serviceauthor: {
        mandatory: false,
        type: 'select-array',
        get_message: {
            action: 'creator-get-objects',
            object_type: 'author'
        },
        return_message: {
            action: 'creator-return-objects',
            object_type: 'author',
            return_value: 'objects'
        }
    },
    patch: {
        mandatory: false,
    },
    remote: {
        mandatory: false,
        type: 'boolean'
    },
    groups: {
        mandatory: false,
        type: 'array-of-pairs',
        fields: ['name', 'desc']
    },
    constants: {
        mandatory: false,
        type: 'select-array',
        get_message: {
            action: 'creator-get-objects',
            object_type: 'constant'
        },
        return_message: {
            action: 'creator-return-objects',
            object_type: 'constant',
            return_value: 'objects'
        }
    },
    classes: {
        mandatory: false,
        type: 'select-array',
        get_message: {
            action: 'creator-get-objects',
            object_type: 'class'
        },
        return_message: {
            action: 'creator-return-objects',
            object_type: 'class',
            return_value: 'objects'
        }
    },
    functions: {
        mandatory: false,
        type: 'select-array',
        get_message: {
            action: 'creator-get-objects',
            object_type: 'function'
        },
        return_message: {
            action: 'creator-return-objects',
            object_type: 'function',
            return_value: 'objects'
        }
    },
    service_modules: {
        mandatory: false,
        type: 'array'
    },
    autostart: {
        mandatory: false,
        type: 'boolean'
    },
    internal: {
        mandatory: false,
        type: 'boolean'
    },
    write: {
        mandatory: false,
        type: 'boolean'
    },
    mappers: {
        mandatory: false,
        type: 'select-array',
        get_message: {
            action: 'creator-get-objects',
            object_type: 'mapper'
        },
        return_message: {
            action: 'creator-return-objects',
            object_type: 'mapper',
            return_value: 'objects'
        }
    },
    vmaps: {
        mandatory: false,
        type: 'select-array',
        get_message: {
            action: 'creator-get-objects',
            object_type: 'value-map'
        },
        return_message: {
            action: 'creator-return-objects',
            object_type: 'value-map',
            return_value: 'objects'
        }
    },
    resource: {
        mandatory: false,
        type: 'file-tree',
        get_message: {
            action: 'creator-get-resources',
            object_type: 'resource'
        },
        return_message: {
            action: 'creator-return-resources',
            object_type: 'resource',
            return_value: 'resources'
        }
    },
    text_resource: {
        mandatory: false,
        type: 'file-tree',
        get_message: {
            action: 'creator-get-resources',
            object_type: 'text-resource'
        },
        return_message: {
            action: 'creator-return-resources',
            object_type: 'text-resource',
            return_value: 'resources'
        }
    },
    bin_resource: {
        mandatory: false,
        type: 'file-tree',
        get_message: {
            action: 'creator-get-resources',
            object_type: 'bin-resource'
        },
        return_message: {
            action: 'creator-return-resources',
            object_type: 'bin-resource',
            return_value: 'resources'
        }
    },
    template: {
        mandatory: false,
        type: 'file-tree',
        get_message: {
            action: 'creator-get-resources',
            object_type: 'template'
        },
        return_message: {
            action: 'creator-return-resources',
            object_type: 'template',
            return_value: 'resources'
        }
    },
    define_auth_label: {
        mandatory: false,
        type: 'array-of-pairs',
        fields: ['label', 'value']
    },
    TAG: {
        mandatory: false,
        type: 'array-of-pairs',
        fields: ['key', 'value']
    },
};


export const fake_service_data = {
    target_dir: os.homedir(),
//    target_file: 
    iface_kind: 'service',
//    lang: 'java',
    class_name: 'ExampleService',
    base_class_name: 'QorusService',

    service: 'example-service',
    serviceversion: '1.0',
    servicedesc: 'example service',
    serviceauthor: ['first author', 'second author'],
    classes: ['ExampleClass1', 'ExampleClass2'],
    groups: [{
        name: 'GROUP1',
        desc: 'example group 1'
    }, {
        name: 'GROUP2',
        desc: 'example group 2'
    }],
    TAG: [{
        key: 'example-code',
        value: 'true'
    }]
};
