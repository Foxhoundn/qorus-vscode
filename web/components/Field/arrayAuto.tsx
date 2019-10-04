import React, { FunctionComponent, useState, useEffect } from 'react';
import useMount from 'react-use/lib/useMount';
import { IField } from '.';
import { IFieldChange } from '../../containers/InterfaceCreator/panel';
import { Callout, ButtonGroup, Button, ControlGroup, Classes } from '@blueprintjs/core';
import reduce from 'lodash/reduce';
import map from 'lodash/map';
import size from 'lodash/size';
import AutoField from './auto';
import { StyledPairField } from './multiPair';

export const allowedTypes: string[] = ['string', 'int', 'float', 'date'];

const ArrayAutoField: FunctionComponent<IField & IFieldChange> = ({
    name,
    onChange,
    value,
    default_value,
    ...rest
}) => {
    const [values, setValues] = useState<{ [id: number]: string | number | null }>({
        1: '',
    });
    const [type, setType] = useState<string>(null);
    const [lastId, setLastId] = useState<number>(1);

    useMount(() => {
        // Set the default value
        onChange(name, value || default_value || transformValues(false, values));
    });

    useEffect(() => {
        // Auto field type depends on other fields' value
        // which will be used as a type
        if (rest['type-depends-on']) {
            // Get the requested type
            const typeValue: string = rest.requestFieldData(rest['type-depends-on'], 'value');
            // Check if the field has the value set yet
            if (typeValue && typeValue !== type) {
                // Set the new type
                setType(typeValue);
                // Reset the values if the type is not
                // supported for allowed values
                if (!allowedTypes.includes(typeValue)) {
                    setValues({ 1: '' });
                }
            }
        }
    });

    useEffect(() => {
        // Transform the values and send them
        const data = transformValues(false, values);
        // Send the data
        onChange(name, data);
    }, [values]);

    const addValue: () => void = () => {
        setLastId((current: number) => {
            setValues(currentValues => ({
                ...currentValues,
                [current + 1]: '',
            }));

            return current + 1;
        });
    };

    const handleRemoveClick: (name: number) => void = name => {
        setValues(current => {
            const newValues = { ...current };
            delete newValues[name];
            return newValues;
        });
    };

    const transformValues: (toValues: boolean, data: any[] | { [id: number]: string | number | null }) => any[] = (
        toValues,
        data
    ) => {
        // Transform data to the object based values
        if (toValues) {
            return data.reduce((newData, val: string | number, index: number) => ({ ...newData, [index]: val }), {});
        }
        // Transform the data to the end result (simple list)
        else {
            return reduce(data, (newData, value: string | number | null) => [...newData, value], []);
        }
    };

    const handleChange: (name: string, value: any) => void = (name, value) => {
        // Set the new values
        setValues(current => {
            const newValues = { ...current };
            newValues[name] = value;
            return newValues;
        });
    };

    // Only types of string, int, float and date can have
    // allowed values
    if (!allowedTypes.includes(type)) {
        // Show the error message
        return <Callout intent="danger">{rest.t('AllowedValuesWarningType')}</Callout>;
    }

    // Render list of auto fields
    return (
        <>
            {map(values, (val: string | number, name: number) => (
                <StyledPairField>
                    <ControlGroup fill>
                        <Button text={`${name}.`} className={Classes.FIXED} />
                        <AutoField {...rest} name={name} value={val} onChange={handleChange} />
                        {size(values) !== 1 && (
                            <Button className={Classes.FIXED} icon={'trash'} onClick={() => handleRemoveClick(name)} />
                        )}
                    </ControlGroup>
                </StyledPairField>
            ))}
            <ButtonGroup fill>
                <Button onClick={addValue} icon="add" />
            </ButtonGroup>
        </>
    );
};

export default ArrayAutoField;