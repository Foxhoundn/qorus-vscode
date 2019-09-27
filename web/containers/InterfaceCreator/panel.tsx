import React, { FunctionComponent, useState, FormEvent, useEffect, useRef } from 'react';
import useEffectOnce from 'react-use/lib/useEffectOnce';
import withMessageHandler, { TMessageListener, TPostMessage } from '../../hocomponents/withMessageHandler';
import { Messages } from '../../constants/messages';
import { size, map, filter, find, includes, reduce, camelCase, upperFirst, omit } from 'lodash';
import SidePanel from '../../components/SidePanel';
import FieldSelector from '../../components/FieldSelector';
import Content from '../../components/Content';
import compose from 'recompose/compose';
import mapProps from 'recompose/mapProps';
import onlyUpdateForKeys from 'recompose/onlyUpdateForKeys';
import withTextContext from '../../hocomponents/withTextContext';
import { TTranslator } from '../../App';
import Field from '../../components/Field';
import FieldLabel from '../../components/FieldLabel';
import styled from 'styled-components';
import FieldActions from '../../components/FieldActions';
import { InputGroup, Intent, ButtonGroup, Button, Classes, Tooltip, Dialog } from '@blueprintjs/core';
import { validateField } from '../../helpers/validations';
import withFieldsConsumer from '../../hocomponents/withFieldsConsumer';
import withInitialDataConsumer from '../../hocomponents/withInitialDataConsumer';
import ConfigItemManager from '../ConfigItemManager';
import ManageConfigButton from '../ConfigItemManager/manageButton';

export interface IInterfaceCreatorPanel {
    type: string;
    addMessageListener: TMessageListener;
    postMessage: TPostMessage;
    onSubmit: (fields: any) => void;
    t: TTranslator;
    methodsList: { id: number; name: string }[];
    forceSubmit?: boolean;
    resetFields: (type: string) => void;
    openFileOnSubmit: boolean;
    hasConfigManager?: boolean;
}

export interface IField {
    get_message?: { action: string; object_type: string; return_value?: string };
    return_message?: { action: string; object_type: string; return_value?: string };
    style?: string;
    type?: string;
    default_value?: string;
    items?: { value: string; icon_filename: string }[];
    prefill?: any;
    name: string;
    mandatory?: boolean;
    selected?: boolean;
    fields?: string[];
    value?: any;
    isValid?: boolean;
    hasValueSet?: boolean;
    internal?: boolean;
    on_change?: string;
}

export declare interface IFieldChange {
    onChange: (fieldName: string, value: any) => void;
}

export const FieldWrapper = styled.div`
    display: flex;
    flex-flow: row;
    &:not(:first-child) {
        margin-top: 20px;
    }
    flex: none;
`;

export const FieldInputWrapper = styled.div`
    flex: 1 auto;
`;

export const SearchWrapper = styled.div`
    flex: 0;
    margin-bottom: 10px;
`;
export const ContentWrapper = styled.div`
    flex: 1;
    overflow-y: auto;
    overflow-x: ${props => (props.scrollX ? 'auto' : 'hidden')};
    padding-right: 10px;
`;

export const ActionsWrapper = styled.div`
    flex: 0;
    margin-top: 10px;
`;

const InterfaceCreatorPanel: FunctionComponent<IInterfaceCreatorPanel> = ({
    type,
    addMessageListener,
    postMessage,
    t,
    fields,
    setFields,
    selectedFields,
    setSelectedFields,
    query,
    setQuery,
    selectedQuery,
    setSelectedQuery,
    onSubmit,
    activeId,
    onNameChange,
    isFormValid,
    stepOneTitle = 'SelectFieldsTitle',
    stepTwoTitle = 'FillDataTitle',
    submitLabel = 'Submit',
    onBackClick,
    allSelectedFields,
    data,
    onDataFinishLoading,
    isEditing,
    allMethodsData,
    methodsList,
    forceSubmit,
    resetFields,
    openFileOnSubmit,
    initialData,
    hasConfigManager,
}) => {
    const isInitialMount = useRef(true);
    const [show, setShow] = useState<boolean>(false);
    const [messageListener, setMessageListener] = useState(null);
    const [showConfigItemsManager, setShowConfigItemsManager] = useState<boolean>(false);

    useEffect(() => {
        // Remove the message listener if it exists
        messageListener && messageListener();
        // Create a message listener for this activeId
        const messageListenerHandler = addMessageListener(
            Messages.FIELDS_FETCHED,
            ({ fields: newFields, ...rest }: { newFields: { [key: string]: IField } }) => {
                // Register only for this interface
                if (rest.iface_kind === type) {
                    if (!fields || !fields.length) {
                        // Mark the selected fields
                        const transformedFields: IField[] = map(newFields, (field: IField) => ({
                            ...field,
                            selected: (data && data[field.name]) || field.mandatory !== false,
                            isValid:
                                data && data[field.name]
                                    ? validateField(field.type || 'string', data[field.name], field)
                                    : false,
                            value: data ? data[field.name] : undefined,
                        }));
                        // Pull the pre-selected fields
                        const preselectedFields: IField[] = filter(
                            transformedFields,
                            (field: IField) => field.selected
                        );
                        // Add original name field
                        if (isEditing) {
                            preselectedFields.push({
                                name: 'orig_name',
                                value: data && data.name,
                                isValid: true,
                                selected: true,
                                internal: true,
                            });
                        }
                        // Save preselected fields
                        setSelectedFields(type, preselectedFields, activeId);
                        // Save the fields
                        setFields(type, transformedFields, activeId);
                    }
                    // Check if onDataFinish function is set
                    // only do this on initial mount
                    if (onDataFinishLoading && isInitialMount.current) {
                        // Run the callback
                        onDataFinishLoading();
                        // Set the mount to false
                        isInitialMount.current = false;
                    }
                    // Set show
                    setShow(true);
                }
            }
        );
        // Set the new message listener
        setMessageListener(() => messageListenerHandler);
        // Fetch the fields
        postMessage(Messages.GET_FIELDS, { iface_kind: type });
        // Cleanup on unmount
        return () => {
            // Remove the message listener if it exists
            messageListenerHandler();
        };
    }, [activeId]);

    const resetLocalFields: (newActiveId: number) => void = newActiveId => {
        // Hide the fields until they are fetched
        setShow(false);
        // Change the name if needed
        if (onNameChange) {
            onNameChange(newActiveId, null);
        }
        // Remove the message listener if it exists
        messageListener && messageListener();
        // Create a message listener for this activeId
        const messageListenerHandler = addMessageListener(
            Messages.FIELDS_FETCHED,
            ({ fields: newFields, iface_kind }: { newFields: { [key: string]: IField } }) => {
                // Register only for this interface
                if (iface_kind === type) {
                    // Mark the selected fields
                    const transformedFields: IField[] = map(newFields, (field: IField) => ({
                        ...field,
                        selected: (data && data[field.name]) || field.mandatory !== false,
                        isValid:
                            data && data[field.name]
                                ? validateField(field.type || 'string', data[field.name], field)
                                : false,
                        value: data ? data[field.name] : undefined,
                    }));
                    // Pull the pre-selected fields
                    const preselectedFields: IField[] = filter(transformedFields, (field: IField) => field.selected);
                    // Save preselected fields
                    setSelectedFields(type, preselectedFields, newActiveId);
                    // Save the fields
                    setFields(type, transformedFields, newActiveId);
                    // Set show
                    setShow(true);
                }
            }
        );
        // Set the new message listener
        setMessageListener(() => messageListenerHandler);
        // Fetch the fields
        postMessage(Messages.GET_FIELDS, { iface_kind: type });
    };

    const addField: (fieldName: string) => void = fieldName => {
        // Remove the field
        setFields(
            type,
            (current: IField[]) =>
                map(current, (field: IField) => ({
                    ...field,
                    selected: fieldName === field.name ? true : field.selected,
                })),
            activeId
        );
        // Get the field
        const field: IField = find(fields, (field: IField) => field.name === fieldName);
        // Add the field to selected list
        setSelectedFields(
            type,
            (current: IField[]) => [
                ...current,
                {
                    ...field,
                    selected: true,
                },
            ],
            activeId
        );
    };

    const removeField: (fieldName: string) => void = fieldName => {
        // Remove the field
        setFields(
            type,
            (current: IField[]) =>
                map(current, (field: IField) => ({
                    ...field,
                    selected: fieldName === field.name ? false : field.selected,
                })),
            activeId
        );
        // Add the field to selected list
        setSelectedFields(
            type,
            (current: IField[]) => filter(current, (field: IField) => field.name !== fieldName),
            activeId
        );
    };

    const handleAddClick: (fieldName: string) => void = fieldName => {
        addField(fieldName);
    };

    const handleFieldChange: (fieldName: string, value: any, explicit?: boolean) => void = (
        fieldName,
        value,
        explicit
    ) => {
        setSelectedFields(
            type,
            (currentFields: IField[]): IField[] => {
                return currentFields.reduce((newFields: IField[], currentField: IField): IField[] => {
                    // Check if the field matches
                    if (currentField.name === fieldName) {
                        // Check if this field prefills any other fields
                        const prefills: IField[] = currentFields.filter((field: IField) => field.prefill === fieldName);
                        // Update the value of all of the prefill field
                        // But only if they did not set the value themselves
                        if (prefills.length) {
                            prefills.forEach((field: IField) => {
                                // Check if the field already has a value set
                                // by its self
                                if (!field.hasValueSet) {
                                    // Modify the field
                                    setTimeout(() => {
                                        handleFieldChange(field.name, value, true);
                                    }, 300);
                                }
                            });
                        }
                        // Check if this field needs style changes
                        if (currentField.style) {
                            // Modify the value based on the style
                            switch (currentField.style) {
                                case 'PascalCase':
                                    value = upperFirst(camelCase(value));
                                    break;
                                case 'camelCase':
                                    value = camelCase(value);
                                    break;
                                default:
                                    break;
                            }
                        }
                        // Run the validation for this type
                        const isValid: boolean = validateField(currentField.type || 'string', value, currentField);
                        // Check if we should change the name of the
                        // method
                        if (fieldName === 'name' && onNameChange) {
                            // Change the method name in the side panel
                            onNameChange(activeId, value);
                        }
                        // Check if this field has an on_change message
                        if (currentField.on_change) {
                            // Post the message with this handler
                            postMessage(currentField.on_change, {
                                [currentField.name]: value,
                                iface_kind: type,
                            });
                        }
                        // Add the value
                        return [
                            ...newFields,
                            {
                                ...currentField,
                                value,
                                hasValueSet: !explicit,
                                isValid,
                            },
                        ];
                    }
                    // Return unchanged fields
                    return [...newFields, { ...currentField }];
                }, []);
            },
            activeId
        );
    };

    const handleAddAll: () => void = () => {
        // Add all remaning fields that are
        // not yet selected
        fields.forEach((field: IField): void => {
            if (!field.selected) {
                addField(field.name);
            }
        });
    };

    const handleSubmitClick: () => void = () => {
        if (onSubmit) {
            onSubmit(selectedFields);
        }

        if (!onSubmit || forceSubmit) {
            let newData: { [key: string]: any };
            // If this is service methods
            if (type === 'service-methods') {
                // Get the service data
                newData = reduce(
                    allSelectedFields.service,
                    (result: { [key: string]: any }, field: IField) => ({
                        ...result,
                        [field.name]: field.value,
                    }),
                    {}
                );
                // Add the methods
                newData.methods = map(allSelectedFields['service-methods'], serviceMethod => {
                    return reduce(
                        serviceMethod,
                        (result: { [key: string]: any }, field: IField) => ({
                            ...result,
                            [field.name]: field.value,
                        }),
                        {}
                    );
                });
                // Add missing methods
                if (allMethodsData) {
                    allMethodsData.forEach(method => {
                        // Check if this method exists in the
                        // data hash also check if the method has been deleted
                        if (!newData.methods.find(m => m.orig_name === method.name)) {
                            // Add this method
                            newData.methods.push(omit({ ...method, orig_name: method.name }, ['id', 'internal']));
                        }
                    });
                }
                // Filter deleted methods
                if (methodsList) {
                    newData.methods = newData.methods.filter(m => methodsList.find(ml => ml.name === m.name));
                }
            } else {
                // Build the finished object
                newData = reduce(
                    selectedFields,
                    (result: { [key: string]: any }, field: IField) => ({
                        ...result,
                        [field.name]: field.value,
                    }),
                    {}
                );
            }
            // Add workflow data with step
            if (type === 'step') {
                // Get the service data
                const workflow = reduce(
                    allSelectedFields.workflow,
                    (result: { [key: string]: any }, field: IField) => ({
                        ...result,
                        [field.name]: field.value,
                    }),
                    {}
                );
                postMessage(isEditing ? Messages.EDIT_INTERFACE : Messages.CREATE_INTERFACE, {
                    iface_kind: type,
                    data: newData,
                    orig_data: data,
                    workflow,
                    open_file_on_success: openFileOnSubmit !== false,
                });
            } else {
                postMessage(isEditing ? Messages.EDIT_INTERFACE : Messages.CREATE_INTERFACE, {
                    iface_kind: type === 'service-methods' ? 'service' : type,
                    data: newData,
                    orig_data: type === 'service-methods' ? initialData.service : data,
                    open_file_on_success: openFileOnSubmit !== false,
                });
            }
            // Reset the fields
            resetFields(type);
            // Reset the interface data
            initialData.resetInterfaceData(type);
        }
    };

    if (!size(fields) || !show) {
        return <p>{t('LoadingFields')}</p>;
    }

    // Filter out the selected fields
    const fieldList: IField[] = filter(fields, (field: IField) => {
        // Only included unselected fields
        if (!field.selected) {
            // Check if the query is set
            if (query && query !== '') {
                return includes(field.name.toLowerCase(), query.toLowerCase());
            } else {
                return true;
            }
        } else {
            return false;
        }
    });

    // Filter out the selected fields
    const selectedFieldList: IField[] = filter(selectedFields, (field: IField) => {
        // Only included unselected fields
        if (field.selected) {
            // Check if the query is set
            if (selectedQuery && selectedQuery !== '') {
                return includes(field.name.toLowerCase(), selectedQuery.toLowerCase());
            } else {
                return true;
            }
        } else {
            return false;
        }
    });

    const isBaseClassNameValid =
        selectedFields && selectedFields.find((field: IField) => field.name === 'base-class-name' && field.isValid);

    return (
        <>
            <SidePanel title={t(stepOneTitle)}>
                <SearchWrapper>
                    <InputGroup
                        placeholder={t('FilterAvailableFields')}
                        value={query}
                        onChange={(event: FormEvent<HTMLInputElement>) => setQuery(type, event.currentTarget.value)}
                        leftIcon={'search'}
                        intent={query !== '' ? Intent.PRIMARY : Intent.NONE}
                    />
                </SearchWrapper>
                <ContentWrapper>
                    {fieldList.length ? (
                        map(fieldList, (field: any) => (
                            <FieldSelector name={field.name} type={field.type} onClick={handleAddClick} />
                        ))
                    ) : (
                        <p className={Classes.TEXT_MUTED}>No fields available</p>
                    )}
                </ContentWrapper>
                {fieldList.length ? (
                    <ActionsWrapper>
                        <ButtonGroup fill>
                            <Tooltip content={t('SelectAllTooltip')}>
                                <Button text={t('SelectAll')} icon={'plus'} onClick={handleAddAll} />
                            </Tooltip>
                        </ButtonGroup>
                    </ActionsWrapper>
                ) : null}
            </SidePanel>
            <Content title={t(stepTwoTitle)}>
                <SearchWrapper>
                    <InputGroup
                        placeholder={t('FilterSelectedFields')}
                        value={selectedQuery}
                        onChange={(event: FormEvent<HTMLInputElement>) =>
                            setSelectedQuery(type, event.currentTarget.value)
                        }
                        leftIcon={'search'}
                        intent={selectedQuery !== '' ? Intent.PRIMARY : Intent.NONE}
                    />
                </SearchWrapper>
                <ContentWrapper>
                    {map(
                        selectedFieldList,
                        (field: IField) =>
                            !field.internal && (
                                <FieldWrapper key={field.name}>
                                    <FieldLabel label={t(`field-label-${field.name}`)} isValid={field.isValid} />
                                    <FieldInputWrapper>
                                        <Field
                                            {...field}
                                            onChange={handleFieldChange}
                                            iface_kind={type}
                                            activeId={activeId}
                                            prefill={
                                                field.prefill &&
                                                selectedFieldList.find(
                                                    (preField: IField) => preField.name === field.prefill
                                                )
                                            }
                                        />
                                    </FieldInputWrapper>
                                    <FieldActions
                                        desc={t(`field-desc-${field.name}`)}
                                        name={field.name}
                                        onClick={removeField}
                                        removable={field.mandatory === false}
                                    />
                                </FieldWrapper>
                            )
                    )}
                </ContentWrapper>
                <ActionsWrapper>
                    {hasConfigManager && (
                        <div style={{ float: 'left', width: '48%' }}>
                            <ManageConfigButton
                                disabled={!isBaseClassNameValid}
                                onClick={() => setShowConfigItemsManager(true)}
                            />
                        </div>
                    )}
                    <div style={{ float: 'right', width: hasConfigManager ? '48%' : '100%' }}>
                        <ButtonGroup fill>
                            {onBackClick && (
                                <Tooltip content={'BackToooltip'}>
                                    <Button text={t('Back')} icon={'undo'} onClick={() => onBackClick()} />
                                </Tooltip>
                            )}
                            <Tooltip content={t('ResetTooltip')}>
                                <Button text={t('Reset')} icon={'history'} onClick={() => resetLocalFields(activeId)} />
                            </Tooltip>
                            <Button
                                text={t(submitLabel)}
                                disabled={!isFormValid(type)}
                                icon={'tick'}
                                intent={Intent.SUCCESS}
                                onClick={handleSubmitClick}
                            />
                        </ButtonGroup>
                    </div>
                </ActionsWrapper>
            </Content>
            {showConfigItemsManager && (
                <Dialog
                    isOpen
                    title={t('ConfigItemsManager')}
                    onClose={() => setShowConfigItemsManager(false)}
                    style={{ width: '80vw', backgroundColor: '#fff' }}
                >
                    <ConfigItemManager
                        type={type}
                        baseClassName={selectedFields.find((field: IField) => field.name === 'base-class-name').value}
                        originalData={data}
                    />
                </Dialog>
            )}
        </>
    );
};

export default compose(
    withTextContext(),
    withMessageHandler(),
    withFieldsConsumer(),
    withInitialDataConsumer(),
    mapProps(({ type, fields, selectedFields, query, selectedQuery, activeId, ...rest }) => ({
        fields: activeId ? fields[type][activeId] : fields[type],
        selectedFields: activeId ? selectedFields[type][activeId] : selectedFields[type],
        query: query[type],
        selectedQuery: selectedQuery[type],
        allSelectedFields: selectedFields,
        type,
        activeId,
        ...rest,
    }))
)(InterfaceCreatorPanel);
