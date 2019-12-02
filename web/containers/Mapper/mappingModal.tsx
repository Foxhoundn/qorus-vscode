import React, { FC, useState } from 'react';
import { Button, Dialog, ButtonGroup, Classes } from '@blueprintjs/core';
import { TTranslator } from '../../App';
import Box from '../../components/ResponsiveBox';
import size from 'lodash/size';
import map from 'lodash/map';
import reduce from 'lodash/reduce';
import every from 'lodash/every';
import { ContentWrapper, FieldWrapper, FieldInputWrapper, ActionsWrapper } from '../InterfaceCreator/panel';
import FieldLabel from '../../components/FieldLabel';
import { validateField } from '../../helpers/validations';
import withInitialDataConsumer from '../../hocomponents/withInitialDataConsumer';
import Content from '../../components/Content';
import SidePanel from '../../components/SidePanel';
import FieldSelector from '../../components/FieldSelector';
import Field from '../../components/Field';
import FieldActions from '../../components/FieldActions';
import OptionHashField from '../../components/Field/optionHash';
import MapperCodeField from '../../components/Field/mapperCode';
import SelectField from '../../components/Field/select';

export interface IMapperFieldModalProps {
    onClose: () => any;
    onSubmit: (data: any) => any;
    t: TTranslator;
    initialData: any;
    relationData: any;
    mapperKeys: any;
    output: any;
    inputs: any[];
}

const MapperFieldModal: FC<IMapperFieldModalProps> = ({
    onClose,
    relationData,
    mapperKeys,
    t,
    onSubmit,
    output,
    inputs,
}) => {
    const [relation, setRelation] = useState(relationData || {});

    const handleChange: (key: string, value: any) => void = (key, value) => {
        setRelation(current => {
            const newField = { ...current };
            newField[key] = value;
            return newField;
        });
    };

    const handleOptionHashChange: (name: string, value: { id: number; name: string; value: string }[]) => void = (
        _name,
        value
    ) => {
        setRelation(current => {
            const newField = { ...current };
            newField.type_options = value;
            return newField;
        });
    };

    const isMappingValid: () => boolean = () => {
        // Check if all keys are valid
        return every(relation, (value, key) => getIsFieldValid(key, value));
    };

    const getIsFieldValid: (key: string, value: any) => boolean = (key, value) => {
        let valid = true;
        // Get the key type
        const fieldType = getKeyType(key);
        // Special types
        if (fieldType === 'option_hash') {
            // Check if the value exists
            if (value) {
                // Map through the options
                value.forEach(val => {
                    // Get the type of this option
                    const optionType = output.type.supported_options[val.name]?.type;
                    // Check if the option is valid
                    if (!validateField(optionType, val.value)) {
                        valid = false;
                    }
                });
            } else {
                valid = false;
            }
        } else if (!validateField(fieldType, value)) {
            valid = false;
        }

        return valid;
    };

    const handleSubmit = () => {
        // Submit the field
        onSubmit(relation);
        onClose();
    };

    const handleAddClick = (name: string) => {
        setRelation(current => ({
            ...current,
            [name]: null,
        }));
    };

    const handleRemoveClick = (name: string) => {
        setRelation(current => {
            let result = { ...current };
            // Remove the key
            delete result[name];
            // Build new unique roles
            const updatedRoles: string[] = reduce(
                result,
                (roles, _value, key) =>
                    mapperKeys[key].unique_roles ? [...roles, ...mapperKeys[key].unique_roles] : roles,
                []
            );
            // Filter any items that are dependent on the removed item
            result = reduce(
                result,
                (newRelation, value, key) => {
                    const { requires_roles } = mapperKeys[key];
                    // Check if this key has required roles
                    if (requires_roles) {
                        // Check if the condition for required roles is still
                        // met, because a field could be removed that is the required
                        // roles
                        if (requires_roles.every(role => updatedRoles.includes(role))) {
                            // Keep the key in
                            return { ...newRelation, [key]: value };
                        }
                        // Filter the field out
                        else {
                            return newRelation;
                        }
                    }
                    // Return unchanged key
                    return { ...newRelation, [key]: value };
                },
                {}
            );
            // Return the new relation
            return result;
        });
    };

    const uniqueRoles: string[] = reduce(
        relation,
        (roles, _value, key) => (mapperKeys[key].unique_roles ? [...roles, ...mapperKeys[key].unique_roles] : roles),
        []
    );

    const isKeyDisabled = (name: string): boolean => {
        let isDisabled = false;
        const { requires_roles, unique_roles } = mapperKeys[name];
        // Check if this field is dependent on other fields
        if (requires_roles) {
            // Check if all the keys from the list
            // are selected
            if (!requires_roles.every(role => uniqueRoles.includes(role))) {
                isDisabled = true;
            }
        }
        // If the roles list does not exist
        if (!unique_roles) {
            // This field can be added except if there is a
            // key with * role
            if (uniqueRoles.includes('*')) {
                isDisabled = true;
            }
        }
        // Check if this key can be added solely
        else if (unique_roles.includes('*')) {
            // This key can only be added if there is no
            // other key yet added
            if (size(relation) > 0) {
                isDisabled = true;
            }
        } else {
            // Check if none of the keys roles & a * role isn't
            // yet included
            if (!unique_roles.every(role => !uniqueRoles.includes(role)) || uniqueRoles.includes('*')) {
                isDisabled = true;
            }
        }
        // Return the result
        return isDisabled;
    };

    const getKeyType = (key: string): string => {
        return mapperKeys[key].value_type === 'any' && mapperKeys[key].requires_field_type
            ? output.type.base_type
            : mapperKeys[key].value_type;
    };

    const getOptions: () => { name: string; desc: string }[] = () => {
        return reduce(
            output.type.supported_options,
            (transformedOpts, data, opt) => [...transformedOpts, { name: opt, desc: data.desc }],
            []
        );
    };

    const mapperKeysList = reduce(
        mapperKeys,
        (newMapperKeys, value, key) => {
            // Check if this mapper key is already selected
            if (key in relation) {
                // This field is selected, remove it
                return newMapperKeys;
            }
            // Field is not selected
            return { ...newMapperKeys, [key]: value };
        },
        {}
    );

    const getPossibleInputs =
        inputs &&
        inputs
            .filter(input => {
                return (
                    size(input.type.types_returned) <= size(output.type.types_accepted) &&
                    output.type.types_accepted.some((type: string) => input.type.types_returned.includes(type))
                );
            })
            .map(input => ({
                name: input.path,
                desc: input.desc,
            }));

    return (
        <Dialog isOpen title={t('ManageOutputMapping')} onClose={onClose} style={{ paddingBottom: 0, width: '70vw' }}>
            <Box top fill scrollY style={{ flexFlow: 'row' }}>
                <SidePanel title={t('AddValue')}>
                    <ContentWrapper>
                        {map(mapperKeysList, (_field: any, fieldName: string) => (
                            <FieldSelector
                                name={fieldName}
                                translateName={false}
                                type={getKeyType(fieldName)}
                                disabled={isKeyDisabled(fieldName)}
                                onClick={handleAddClick}
                            />
                        ))}
                    </ContentWrapper>
                </SidePanel>
                <Content title={t('FillValues')} style={{ height: 'unset' }}>
                    <ContentWrapper>
                        {size(relation) ? (
                            map(relation, (value: string, key: string) => (
                                <FieldWrapper>
                                    <FieldLabel label={key} isValid={getIsFieldValid(key, value)} />
                                    <FieldInputWrapper>
                                        {getKeyType(key) === 'mapper-code' ? (
                                            <MapperCodeField
                                                onChange={handleChange}
                                                defaultCode={value && value.split('.')[0]}
                                                defaultMethod={value && value.split('.')[1]}
                                            />
                                        ) : getKeyType(key) === 'option_hash' ? (
                                            <OptionHashField
                                                name={key}
                                                value={value || undefined}
                                                onChange={handleOptionHashChange}
                                                items={getOptions()}
                                                options={output.type.supported_options}
                                            />
                                        ) : key === 'name' ? (
                                            <SelectField
                                                name={key}
                                                value={value}
                                                defaultItems={getPossibleInputs}
                                                onChange={handleChange}
                                            />
                                        ) : (
                                            <Field
                                                name={key}
                                                value={value}
                                                type="auto"
                                                defaultType={getKeyType(key)}
                                                onChange={handleChange}
                                            />
                                        )}
                                    </FieldInputWrapper>
                                    <FieldActions name={key} onClick={handleRemoveClick} removable />
                                </FieldWrapper>
                            ))
                        ) : (
                            <p className={Classes.TEXT_MUTED}>No fields available</p>
                        )}
                    </ContentWrapper>

                    <ActionsWrapper style={{ marginTop: 20 }}>
                        <ButtonGroup fill>
                            <Button text="Reset" icon="history" onClick={() => setRelation(relationData || {})} />
                            <Button
                                intent="success"
                                text="Submit"
                                icon="small-tick"
                                disabled={!isMappingValid()}
                                onClick={handleSubmit}
                            />
                        </ButtonGroup>
                    </ActionsWrapper>
                </Content>
            </Box>
        </Dialog>
    );
};

export default withInitialDataConsumer()(MapperFieldModal);
