import React, { FunctionComponent, useState, useEffect } from 'react';
import mapProps from 'recompose/mapProps';
import compose from 'recompose/compose';
import { get, set, unset, forEach, reduce, size } from 'lodash';
import { MapperContext } from '../context/mapper';
import string from '../components/Field/string';
import useMount from 'react-use/lib/useMount';
import { providers } from '../containers/Mapper/provider';
import withTextContext from './withTextContext';
import { Callout } from '@blueprintjs/core';
import { IMapperRelation } from '../containers/Mapper';

// A HoC helper that holds all the state for interface creations
export default () => (Component: FunctionComponent<any>): FunctionComponent<any> => {
    const EnhancedComponent: FunctionComponent = (props: any) => {
        const { qorus_instance } = props;
        const [showMapperConnections, setShowMapperConnections] = useState<boolean>(false);
        const [inputs, setInputs] = useState<any>(null);
        const [outputs, setOutputs] = useState<any>(null);
        const [inputProvider, setInputProvider] = useState<string>(null);
        const [outputProvider, setOutputProvider] = useState<string>(null);
        const [relations, setRelations] = useState<{
            [outputPath: string]: {
                name?: string;
                code?: string;
                constant?: string;
                sequence?: string;
            };
        }>({});
        const [inputsLoading, setInputsLoading] = useState<boolean>(false);
        const [outputsLoading, setOutputsLoading] = useState<boolean>(false);
        const [inputChildren, setInputChildren] = useState<any[]>([]);
        const [outputChildren, setOutputChildren] = useState<any[]>([]);
        const [inputRecord, setInputRecord] = useState<any>(null);
        const [outputRecord, setOutputRecord] = useState<any>(null);
        const [inputOptionProvider, setInputOptionProvider] = useState<{ name: string; type: string; path?: string }>(
            null
        );
        const [outputOptionProvider, setOutputOptionProvider] = useState<{ name: string; type: string; path?: string }>(
            null
        );
        const [mapperKeys, setMapperKeys] = useState<any>(null);
        const [hideInputSelector, setHideInputSelector] = useState<boolean>(false);
        const [hideOutputSelector, setHideOutputSelector] = useState<boolean>(false);
        const [error, setError] = useState<any>(null);
        const [wrongKeysCount, setWrongKeysCount] = useState<number>(0);

        const resetMapper = () => {
            setShowMapperConnections(false);
            setInputs(null);
            setOutputs(null);
            setInputProvider(null);
            setOutputProvider(null);
            setRelations({});
            setInputsLoading(false);
            setOutputsLoading(false);
            setInputChildren([]);
            setOutputChildren([]);
            setInputRecord(null);
            setOutputRecord(null);
            setInputOptionProvider(null);
            setOutputOptionProvider(null);
            setHideInputSelector(false);
            setHideOutputSelector(false);
        };

        const getUrlFromProvider: (fieldType: 'input' | 'output') => string = fieldType => {
            const { type, name, path } = fieldType === 'input' ? inputOptionProvider : outputOptionProvider;
            // Get the rules for the given provider
            const { url, suffix, recordSuffix, requiresRecord } = providers[type];
            // Build the URL based on the provider type
            return `${url}/${name}${suffix}${path}${requiresRecord ? recordSuffix : ''}`;
        };

        const getProviderUrl: (fieldType: 'input' | 'output') => string = fieldType => {
            // Get the mapper options data
            const { type, name, path = '' } = props.mapper.mapper_options[`mapper-${fieldType}`];
            // Save the provider options
            if (fieldType === 'input') {
                setInputOptionProvider({
                    type,
                    name,
                    path,
                });
            } else {
                setOutputOptionProvider({
                    type,
                    name,
                    path,
                });
            }
            // Get the rules for the given provider
            const { url, suffix, recordSuffix, requiresRecord } = providers[type];
            // Build the URL based on the provider type
            return `${url}/${name}${suffix}${path}${requiresRecord ? recordSuffix : ''}`;
        };

        const getMapperKeysUrl: (fieldType: 'input' | 'output') => string = fieldType => {
            // Get the mapper options data
            const { type, name, path = '' } = props.mapper.mapper_options[`mapper-${fieldType}`];
            // Get the rules for the given provider
            const { url, suffix } = providers[type];
            // Build the URL based on the provider type
            return `${url}/${name}${suffix}${path}/mapper_keys`;
        };

        const insertCustomFields = (fields, customFields = {}) => {
            const newFields = { ...fields };
            // Loop throught the custom fields
            forEach(customFields, field => {
                // Build the path
                const fields: string[] = field.path.split('.');
                let newPath: string;
                fields.forEach(fieldName => {
                    if (!newPath) {
                        newPath = fieldName;
                    } else {
                        newPath += `.type.fields.${fieldName}`;
                    }
                });
                // Insert the top custom field based on the path
                set(newFields, newPath, field);
            });

            return newFields;
        };

        const checkMapperKeys = (relations, mapperKeys) => {
            return reduce(
                relations,
                (newRelations, keys, fieldName) => {
                    // Filter out the keys that do not belong to these mapper keys
                    const newKeys = reduce(
                        keys,
                        (newKeys, key, keyName) => {
                            if (Object.keys(mapperKeys).includes(keyName)) {
                                return { ...newKeys, [keyName]: key };
                            }
                            // This key does not exist
                            // Raise the alerts
                            setWrongKeysCount(cur => cur + 1);
                            return newKeys;
                        },
                        {}
                    );
                    // Save the field
                    if (size(newKeys) !== 0) {
                        return { ...newRelations, [fieldName]: newKeys };
                    }
                    // Return unchanged
                    return newRelations;
                },
                {}
            );
        };

        useEffect(() => {
            if (qorus_instance) {
                // Fetch the mapper keys
                (async () => {
                    const response = await props.fetchData('system/default_mapper_keys');
                    setMapperKeys(response.data);
                })();
                // Check if user is editing a mapper
                if (props.isEditing) {
                    // Set loading of inputs and outputs
                    setInputsLoading(true);
                    setOutputsLoading(true);
                    // Hide input and output selectors
                    setHideInputSelector(true);
                    setHideOutputSelector(true);
                    // Get URL for input and output providers
                    const inputUrl = getProviderUrl('input');
                    const outputUrl = getProviderUrl('output');
                    // Save the url as a record, to be accessible
                    setInputRecord(inputUrl);
                    setOutputRecord(outputUrl);
                    // Fetch the input and output fields
                    (async () => {
                        const inputs = await props.fetchData(inputUrl);
                        const outputs = await props.fetchData(outputUrl);
                        // If one of the connections is down
                        if (inputs.error || outputs.error) {
                            setError(inputs.error ? 'InputConnError' : 'OutputConnError');
                            return;
                        }
                        const mapperKeysUrl = getMapperKeysUrl('output');
                        // Fetch the mapper keys
                        const mapperKeys = await props.fetchData(mapperKeysUrl);
                        // Check if mapper keys call was good
                        if (mapperKeys.error) {
                            setError('MapperKeysFail');
                            return;
                        }
                        // Save the mapper keys
                        setMapperKeys(mapperKeys.data);
                        // Save the fields
                        const inputFields = inputs.data.fields || inputs.data;
                        const outputFields = outputs.data.fields || outputs.data;
                        // Save the inputs & outputs
                        setInputs(
                            insertCustomFields(
                                inputFields,
                                props.mapper.mapper_options['mapper-input']['custom-fields'] || {}
                            )
                        );
                        setOutputs(
                            insertCustomFields(
                                outputFields,
                                props.mapper.mapper_options['mapper-output']['custom-fields'] || {}
                            )
                        );
                        setRelations(checkMapperKeys(props.mapper.fields, mapperKeys.data) || {});
                        // Cancel loading
                        setInputsLoading(false);
                        setOutputsLoading(false);
                    })();
                }
            }
        }, [qorus_instance]);

        if (!error && qorus_instance && (!mapperKeys || (props.isEditing && (inputsLoading || outputsLoading)))) {
            return <p> Loading ... </p>;
        }

        const addField = (fieldsType, path, data) => {
            // Save the field setters to be easily accessible
            const fieldSetters: any = { inputs: setInputs, outputs: setOutputs };
            // Set the new fields
            fieldSetters[fieldsType](current => {
                // Clone the current fields
                const result: any = { ...current };
                // Build the path
                const fields: string[] = path.split('.');
                let newPath: string;
                fields.forEach(fieldName => {
                    if (!newPath) {
                        newPath = fieldName;
                    } else {
                        newPath += `.type.fields.${fieldName}`;
                    }
                });
                // Get the object at the exact path
                const obj: any = get(result, newPath);
                // Add new object
                obj.type.fields[data.name] = data;
                // Return new data
                return result;
            });
        };

        const editField = (fieldsType, path, data, remove: boolean) => {
            // Save the field setters to be easily accessible
            const fieldSetters: any = { inputs: setInputs, outputs: setOutputs };
            // Set the new fields
            fieldSetters[fieldsType](current => {
                // Clone the current fields
                const result: any = { ...current };
                // Build the path
                const fields: string[] = path.split('.');
                let newPath: string;
                fields.forEach(fieldName => {
                    if (!newPath) {
                        newPath = fieldName;
                    } else {
                        newPath += `.type.fields.${fieldName}`;
                    }
                });
                // Get the object at the exact path
                if (remove) {
                    unset(result, newPath);
                } else {
                    set(result, newPath, data);
                }
                // Return new data
                return result;
            });
        };

        return (
            <MapperContext.Provider
                value={{
                    inputs,
                    setInputs,
                    outputs,
                    setOutputs,
                    inputChildren,
                    setInputChildren,
                    outputChildren,
                    setOutputChildren,
                    inputRecord,
                    setInputRecord,
                    outputRecord,
                    setOutputRecord,
                    inputProvider,
                    setInputProvider,
                    outputProvider,
                    setOutputProvider,
                    relations,
                    setRelations,
                    inputsLoading,
                    setInputsLoading,
                    outputsLoading,
                    setOutputsLoading,
                    showMapperConnections,
                    setShowMapperConnections,
                    addField,
                    editField,
                    mapperKeys,
                    setMapperKeys,
                    inputOptionProvider,
                    outputOptionProvider,
                    setInputOptionProvider,
                    setOutputOptionProvider,
                    isEditing: props.isEditing,
                    hideInputSelector,
                    hideOutputSelector,
                    setHideInputSelector,
                    setHideOutputSelector,
                    resetMapper,
                    getUrlFromProvider,
                    error,
                    wrongKeysCount,
                }}
            >
                <Component {...props} />
            </MapperContext.Provider>
        );
    };

    return compose(
        mapProps(({ mapper, ...rest }) => ({
            initialShow: !!mapper,
            isEditing: !!mapper,
            mapper,
            ...rest,
        })),
        withTextContext()
    )(EnhancedComponent);
};
