import React, { FunctionComponent, useState } from 'react';
import { InitialContext } from '../context/init';
import useMount from 'react-use/lib/useMount';
import { Messages } from '../constants/messages';
import shortid from 'shortid';
import set from 'lodash/set';
import { AppToaster } from '../components/Toast';
import { Toaster } from '@blueprintjs/core';

// A HoC helper that holds all the initial data
export default () => (Component: FunctionComponent<any>): FunctionComponent<any> => {
    const EnhancedComponent: FunctionComponent = (props: any) => {
        const [initialData, setInitialData] = useState<any>({
            tab: 'ProjectConfig',
        });
        const [confirmDialog, setConfirmDialog] = useState<{ isOpen: boolean; onSubmit: () => any; text: string }>({});

        useMount(() => {
            props.addMessageListener(Messages.RETURN_INITIAL_DATA, ({ data }) => {
                setInitialData(null);

                if (!data.tab) {
                    data.tab = 'ProjectConfig';
                }

                setInitialData(current => ({
                    ...current,
                    ...data,
                }));
            });

            props.addMessageListener(Messages.RETURN_INTERFACE_DATA, ({ data }) => {
                // Only set initial data if we are
                // switching tabs
                if (data.tab) {
                    setInitialData(current => ({
                        ...current,
                        ...data,
                    }));
                }
            });

            props.postMessage(Messages.GET_INITIAL_DATA);
        });

        const confirmAction: (text: string, action: () => any) => void = (text, action) => {
            setConfirmDialog({
                isOpen: true,
                text,
                onSubmit: action,
            });
        };

        const changeTab: (tab: string, subtab?: string) => void = (tab, subtab) => {
            setInitialData(current => ({
                ...current,
                tab,
                subtab: subtab || null,
            }));
        };

        const setStepSubmitCallback: (callback: () => any) => void = (callback): void => {
            setInitialData(current => ({
                ...current,
                stepCallback: callback,
            }));
        };

        const resetInterfaceData: (iface: string) => void = iface => {
            setInitialData(current => ({
                ...current,
                [iface]: null,
            }));
        };

        const setActiveInstance: (inst: any) => void = inst => {
            setInitialData(current => ({
                ...current,
                qorus_instance: inst,
            }));
        };

        const changeInitialData: (path: string, value: any) => any = (path, value) => {
            setInitialData(current => {
                const result = { ...current };
                set(result, path, value);
                return result;
            });
        };

        const fetchData: (url: string, method: string) => Promise<any> = async (url, method = 'GET') => {
            // Create the unique ID for this request
            const uniqueId: string = shortid.generate();

            return new Promise((resolve, reject) => {
                // Create a timeout that will reject the request
                // after 2 minutes
                let timeout: NodeJS.Timer | null = setTimeout(() => {
                    reject({
                        error: true,
                        msg: 'Request timed out',
                    });
                }, 120000);
                // Watch for the request to complete
                // if the ID matches then resolve
                props.addMessageListener('fetch-data-complete', data => {
                    if (data.id === uniqueId) {
                        clearTimeout(timeout);
                        timeout = null;
                        resolve(data);
                    }
                });
                // Fetch the data
                props.postMessage('fetch-data', {
                    id: uniqueId,
                    url,
                    method,
                });
            });
        };

        const callBackend: (
            getMessage: string,
            returnMessage: string,
            data: any,
            toastMessage?: string
        ) => Promise<any> = async (getMessage, returnMessage, data, toastMessage) => {
            // Create the unique ID for this request
            const uniqueId: string = shortid.generate();
            // Create new toast
            AppToaster.show(
                {
                    message: toastMessage || 'Request in progress',
                    intent: 'warning',
                    timeout: 30000,
                    icon: 'info-sign',
                },
                uniqueId
            );

            return new Promise((resolve, reject) => {
                // Create a timeout that will reject the request
                // after 2 minutes
                let timeout: NodeJS.Timer | null = setTimeout(() => {
                    AppToaster.show(
                        {
                            message: 'Request timed out',
                            intent: 'danger',
                            timeout: 3000,
                            icon: 'error',
                        },
                        uniqueId
                    );
                    resolve({
                        ok: false,
                        message: 'Request timed out',
                    });
                }, 30000);
                // Watch for the request to complete
                // if the ID matches then resolve
                props.addMessageListener(getMessage, data => {
                    if (data.request_id === uniqueId) {
                        AppToaster.show(
                            {
                                message: data.message,
                                intent: data.ok ? 'success' : 'danger',
                                timeout: 3000,
                                icon: data.ok ? 'small-tick' : 'error',
                            },
                            uniqueId
                        );

                        clearTimeout(timeout);
                        timeout = null;
                        resolve(data);
                    }
                });

                // Fetch the data
                props.postMessage(returnMessage || `${getMessage}-complete`, {
                    request_id: uniqueId,
                    ...data,
                });
            });
        };

        if (!initialData) {
            return null;
        }

        return (
            <InitialContext.Provider
                value={{
                    ...initialData,
                    changeTab,
                    setStepSubmitCallback,
                    resetInterfaceData,
                    setActiveInstance,
                    fetchData,
                    changeInitialData,
                    confirmDialog,
                    setConfirmDialog,
                    confirmAction,
                    callBackend,
                }}
            >
                <InitialContext.Consumer>
                    {initialProps => <Component {...initialProps} {...props} />}
                </InitialContext.Consumer>
            </InitialContext.Provider>
        );
    };

    return EnhancedComponent;
};
