import React, { FunctionComponent, useState, useEffect } from 'react';
import useMount from 'react-use/lib/useMount';
import { IField } from '.';
import { IFieldChange } from '../../containers/InterfaceCreator/panel';
import StringField from './string';
import BooleanField from './boolean';
import DateField from './date';
import TextareaField from './textarea';
import SelectField from './select';
import { Callout, ControlGroup, Button } from '@blueprintjs/core';
import NumberField from './number';
import OptionHashField from './optionHash';
import { getTypeFromValue, maybeParseYaml, getValueOrDefaultValue } from '../../helpers/validations';
import { isBoolean, isNull } from 'util';

const AutoField: FunctionComponent<IField & IFieldChange> = ({
    name,
    onChange,
    value,
    default_value,
    defaultType,
    requestFieldData,
    type,
    t,
    ...rest
}) => {
    const [currentType, setType] = useState<string>(null);
    const [currentInternalType, setInternalType] = useState<string>(null);
    const [isInitialType, setIsInitialType] = useState<boolean>(true);
    const [isSetToNull, setIsSetToNull] = useState<boolean>(false);

    useMount(() => {
        const defType = defaultType && defaultType.replace(/"/g, '').trim();
        // If value already exists, but the type is auto or any
        // set the type based on the value
        if (value && (defType === 'auto' || defType === 'any')) {
            setInternalType(getTypeFromValue(maybeParseYaml(value)));
        } else {
            setInternalType(defType);
        }

        setType(defType);
        // If the value is null and can be null, set the null flag
        if (isNull(getValueOrDefaultValue(value, default_value, canBeNull())) && canBeNull()) {
            setIsSetToNull(true);
        }

        // Set the default value
        handleChange(name, getValueOrDefaultValue(value, default_value, canBeNull()));
    });

    useEffect(() => {
        // Auto field type depends on other fields' value
        // which will be used as a type
        if (rest['type-depends-on']) {
            // Get the requested type
            const typeValue: string = requestFieldData(rest['type-depends-on'], 'value');
            // Check if the field has the value set yet
            if (typeValue && typeValue !== currentType) {
                // If this is auto / any field
                // set the internal type
                if (typeValue === 'auto' || typeValue === 'any') {
                    setInternalType(value ? getTypeFromValue(maybeParseYaml(value)) : null);
                } else {
                    setInternalType(typeValue);
                }
                // Set the new type
                setType(typeValue);
            }
        }
        // If can be undefined was toggled off, but the value right now is null
        // we need to set the ability to be null to false and remove
        if (!canBeNull() && isSetToNull) {
            setIsSetToNull(false);
            handleChange(name, null);
        }
    });

    // Reset the value when type changes
    useEffect(() => {
        // Check if there is actually any type
        if (currentType) {
            // Is this the first time the type is set
            if (isInitialType) {
                // Reset the value
                handleChange(name, value);
                // Set the initial type was set
                setIsInitialType(false);
            } else {
                // Reset the value
                handleChange(name, null);
            }
        }
    }, [currentType]);

    const canBeNull = () => {
        if (requestFieldData) {
            return requestFieldData('can_be_undefined', 'value');
        }

        return false;
    };

    const handleChange: (name: string, value: any) => void = (name, value) => {
        // Run the onchange
        if (onChange) {
            onChange(name, value, currentInternalType, canBeNull());
        }
    };

    const handleNullToggle = () => {
        setIsSetToNull(current => !current);
        // Handle change
        handleChange(name, null);
    };

    const renderField = currentType => {
        // If this field is set to null
        if (isSetToNull) {
            // Render a readonly field with null
            return <StringField name={name} value={null} onChange={handleChange} read_only canBeNull />;
        }
        // Render the field based on the type
        switch (currentType) {
            case 'string':
            case 'data':
            case 'binary':
                return <StringField {...rest} name={name} onChange={handleChange} value={value} type={currentType} />;
            case 'bool':
                return <BooleanField {...rest} name={name} onChange={handleChange} value={value} type={currentType} />;
            case 'date':
                return <DateField {...rest} name={name} onChange={handleChange} value={value} type={currentType} />;
            case 'hash':
            case 'hash<auto>':
            case 'list':
            case 'list<auto>':
                return (
                    <TextareaField
                        {...rest}
                        name={name}
                        onChange={handleChange}
                        value={value}
                        fill
                        type={currentType}
                        placeholder={t('Yaml')}
                    />
                );
            case 'int':
            case 'float':
                return (
                    <NumberField {...rest} name={name} onChange={handleChange} value={value} fill type={currentType} />
                );
            case 'option_hash':
                return (
                    <OptionHashField
                        {...rest}
                        name={name}
                        onChange={handleChange}
                        value={value || undefined}
                        fill
                        type={currentType}
                    />
                );
            default:
                return <Callout>{t('AutoFieldSelectType')}</Callout>;
        }
    };

    // Render type picker if the type is auto or any
    return (
        <>
            {(defaultType === 'auto' || defaultType === 'any' || currentType === 'auto' || currentType === 'any') && (
                <SelectField
                    name="type"
                    defaultItems={[
                        { name: 'bool' },
                        { name: 'date' },
                        { name: 'string' },
                        { name: 'binary' },
                        { name: 'float' },
                        { name: 'list' },
                        { name: 'hash' },
                        { name: 'int' },
                    ]}
                    value={currentInternalType}
                    onChange={(_name, value) => {
                        handleChange(name, null);
                        setInternalType(value);
                    }}
                />
            )}
            <ControlGroup fill>
                {renderField(currentInternalType)}
                {canBeNull() && (
                    <Button
                        intent={isSetToNull ? 'warning' : 'none'}
                        icon={isSetToNull && 'cross'}
                        onClick={handleNullToggle}
                    >
                        {isSetToNull ? 'Unset null' : 'Set as null'}
                    </Button>
                )}
            </ControlGroup>
        </>
    );
};

export default AutoField;
