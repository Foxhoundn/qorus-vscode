import * as msg from '../qorus_message';
const types = ['string', 'int', 'bool', 'float', 'date', 'hash', 'list', 'any'];

export const configItemFields = params => {
    const { interface_info, context: { iface_id, name } = { iface_id: undefined, name: undefined } } = params;
    if (name) {
        const data = interface_info.configItemFieldModifiers(iface_id, name);
        msg.debug({data});
    }

    return [
        {
            name: 'name',
        },
        {
            name: 'description',
            type: 'long-string',
            markdown: true,
        },
        {
            name: 'type',
            type: 'enum',
            items: types.map(type => ({ value: type })),
            default_value: 'string',
            on_change: 'config-item-type-changed',
        },
        {
            name: 'can_be_undefined',
            mandatory: false,
            type: 'boolean',
            default_value: false,
        },
        {
            name: 'default_value',
            mandatory: false,
            type: 'auto',
            'type-depends-on': 'type',
            'allowed-types': types,
        },
        {
            name: 'strictly_local',
            mandatory: false,
            type: 'boolean',
            default_value: false,
        },
        {
            name: 'config_group',
            default_value: interface_info && interface_info.last_config_group,
        },
        {
            name: 'allowed_values',
            mandatory: false,
            type: 'array-auto',
            'type-depends-on': 'type',
            'allowed-types': types,
        },
        {
            name: 'sensitive',
            mandatory: false,
            type: 'boolean',
            default_value: false
        },
    ]
};

export const defaultValue = name => (configItemFields({}).find(field => field.name === name) || {}).default_value;
