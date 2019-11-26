import React, { FC, useState, useCallback } from 'react';
import { Button, Dialog, ButtonGroup } from '@blueprintjs/core';
import { TTranslator } from '../../App';
import Box from '../../components/ResponsiveBox';
import set from 'lodash/set';
import size from 'lodash/size';
import String from '../../components/Field/string';
import { ContentWrapper, FieldWrapper, FieldInputWrapper, ActionsWrapper } from '../InterfaceCreator/panel';
import FieldLabel from '../../components/FieldLabel';
import { validateField } from '../../helpers/validations';
import SelectField from '../../components/Field/select';
import Pull from '../../components/Pull';
import useMount from 'react-use/lib/useMount';
import withInitialDataConsumer from '../../hocomponents/withInitialDataConsumer';
import BooleanField from '../../components/Field/boolean';

export interface IMapperFieldModalProps {
    type: 'inputs' | 'outputs';
    onClose: () => any;
    onSubmit: (data: any) => any;
    t: TTranslator;
    initialData: any;
    siblings: any;
    fieldData: any;
}

const defaultData: any = {
    name: '',
    desc: '',
    type: null,
    isCustom: true,
    canBeNull: false,
};

const MapperFieldModal: FC<IMapperFieldModalProps> = ({
    type,
    siblings,
    onClose,
    fieldData,
    onSubmit,
    t,
    initialData,
}) => {
    const transformFieldData = fieldData => {
        // Save the typename
        const typename = fieldData.type.name;
        // Check if the field has a maybe type
        if (typename.startsWith('*')) {
            // Remove the asterisk
            fieldData.type.name = typename.replace('*', '');
            // Set the maybe type
            fieldData.canBeNull = true;
        }
        // Return the fieldData
        return fieldData;
    };

    const [field, setField] = useState(fieldData ? transformFieldData(fieldData) : defaultData);
    const [types, setTypes] = useState(null);

    useMount(() => {
        (async () => {
            // Fetch the available types
            const types: any = await initialData.fetchData(
                `dataprovider/basetypes${type === 'outputs' ? '?soft=1' : ''}`
            );
            // Save the types
            setTypes(types.data);
        })();
    });

    const onChange: (path: string, value: any) => void = (path, value) => {
        setField(current => {
            const newField = { ...current };
            set(newField, path, value);
            return newField;
        });
    };

    const onTypeChange: (_path: string, value: any) => void = (_path, value) => {
        setField(current => {
            const newField = { ...current };
            // Find the type based on the name
            const fieldType = types.find(type => type.name === value);
            // Set the type
            newField.type = fieldType;
            // Return new field
            return newField;
        });
    };

    const isUnique: (name: string) => boolean = name =>
        !Object.keys(siblings).find((sibling: string) => sibling === name);

    const isFieldValid: () => boolean = () => {
        const isNameValid: boolean = validateField('string', field.name) && isUnique(field.name);
        const isDescValid: boolean = validateField('desc', field.name);
        const isTypeValid: boolean = !!field.type;

        return isNameValid && isDescValid && isTypeValid;
    };

    const handleSubmit = () => {
        // Save the field
        const newField = { ...field };
        // Check if the field can be null
        if (newField.canBeNull) {
            // Transform the field type to the
            // same maybe type
            newField.type = types.find(type => type.name === `*${newField.type.name}`);
        }
        // Submit the field
        onSubmit(newField);
        onClose();
    };

    return (
        <Dialog isOpen title={t('AddNewField')} onClose={onClose} style={{ paddingBottom: 0 }}>
            <Box top fill scrollY>
                <ContentWrapper>
                    {!types && <p>Loading...</p>}
                    {types && (
                        <>
                            <FieldWrapper>
                                <FieldLabel
                                    label={t(`field-label-name`)}
                                    isValid={validateField('string', field.name) && isUnique(field.name)}
                                />
                                <FieldInputWrapper>
                                    <String onChange={onChange} name="name" value={field.name} />
                                </FieldInputWrapper>
                            </FieldWrapper>
                            <FieldWrapper>
                                <FieldLabel
                                    label={t(`field-label-desc`)}
                                    isValid={validateField('string', field.desc)}
                                />
                                <FieldInputWrapper>
                                    <String onChange={onChange} name="desc" value={field.desc} />
                                </FieldInputWrapper>
                            </FieldWrapper>
                            <FieldWrapper>
                                <FieldLabel label={t(`field-label-type`)} isValid={!!field.type} />
                                <FieldInputWrapper>
                                    <SelectField
                                        simple
                                        defaultItems={types
                                            .filter(type => !type.name.startsWith('*'))
                                            .map(type => ({
                                                name: type.name,
                                                desc: '',
                                            }))}
                                        onChange={onTypeChange}
                                        name="type.name"
                                        value={field.type?.name}
                                    />
                                </FieldInputWrapper>
                            </FieldWrapper>
                            <FieldWrapper>
                                <FieldLabel label={t(`field-label-can-be-undefined`)} isValid />
                                <FieldInputWrapper>
                                    <BooleanField onChange={onChange} name="canBeNull" value={field.canBeNull} />
                                </FieldInputWrapper>
                            </FieldWrapper>
                        </>
                    )}
                </ContentWrapper>
                <ActionsWrapper style={{ marginTop: 20 }}>
                    <ButtonGroup fill>
                        <Button
                            text="Reset"
                            icon="history"
                            onClick={() => {
                                setField(fieldData ? transformFieldData(fieldData) : defaultData);
                            }}
                        />
                        <Button
                            intent="success"
                            text="Submit"
                            icon="small-tick"
                            disabled={!isFieldValid()}
                            onClick={handleSubmit}
                        />
                    </ButtonGroup>
                </ActionsWrapper>
            </Box>
        </Dialog>
    );
};

export default withInitialDataConsumer()(MapperFieldModal);
