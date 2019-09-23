export const config_item_fields = [
    {
        name: 'name',
    },
    {
        name: 'desc',
    },
    {
        name: 'type',
        type: 'enum',
        items: [
            { value: 'string' },
            { value: 'int' },
            { value: 'bool' },
            { value: 'float' },
            { value: 'date' },
            { value: 'hash' },
            { value: 'list' }
        ],
        default_value: 'string'
    },
    {
        name: 'default_value',
        mandatory: false,
        type: 'auto',
        type-depends-on: 'type'
    },
    {
        name: 'strictly_local',
        mandatory: false,
        type: 'boolean',
        default_value: false,
    },
    {
        name: 'config_group',
        mandatory: false,
        default_value: 'Default',
    },
    {
        name: 'allowed_values',
        mandatory: false,
        type: 'array-auto'
        type-depends-on: 'type'
    },
];
