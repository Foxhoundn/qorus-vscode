import React, { FunctionComponent, useState } from 'react';
import mapProps from 'recompose/mapProps';
import { get, set, unset } from 'lodash';
import { MapperContext } from '../context/mapper';

// A HoC helper that holds all the state for interface creations
export default () => (Component: FunctionComponent<any>): FunctionComponent<any> => {
    const EnhancedComponent: FunctionComponent = (props: any) => {
        const [showMapperConnections, setShowMapperConnections] = useState<boolean>(props.initialShow);
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
        const [mapperKeys, setMapperKeys] = useState<any>(null);

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
                }}
            >
                <Component {...props} />
            </MapperContext.Provider>
        );
    };

    return mapProps(({ mapper, ...rest }) => ({
        initialShow: !!mapper,
        mapper,
        ...rest,
    }))(EnhancedComponent);
};
