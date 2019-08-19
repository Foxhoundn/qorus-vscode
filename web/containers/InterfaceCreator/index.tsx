import React, { FunctionComponent, useState } from 'react';
import { Tabs, Tab } from '@blueprintjs/core';
import InterfaceCreatorPanel, { IField } from './panel';
import Box from '../../components/Box';
import compose from 'recompose/compose';
import withTextContext from '../../hocomponents/withTextContext';
import { TTranslator } from '../../App';
import SidePanel from '../../components/SidePanel';
import ServicesView from './servicesView';
import withInitialDataConsumer from '../../hocomponents/withInitialDataConsumer';
// import StepsCreator from './stepsCreator';

export interface ICreateInterface {
    targetDir: string;
    t: TTranslator;
    initialData: any;
}

const CreateInterface: FunctionComponent<ICreateInterface> = ({ t, initialData }) => {
    return (
        <Box fill>
            <Tabs
                defaultSelectedTabId={initialData.subtab || 'service'}
                id={'CreateInterfaceTabs'}
                renderActiveTabPanelOnly
                className={'fullHeightTabs'}
            >
                <Tab
                    id={'service'}
                    title={t('Service')}
                    className={'flex-column flex-auto'}
                    panel={<ServicesView service={initialData.service} />}
                />
                {/*<Tab id={'testing'} title={t('Workflows')} panel={<StepsCreator />} />*/}
                <Tab
                    id={'workflow'}
                    title={t('Workflow')}
                    panel={<InterfaceCreatorPanel type={'workflow'} data={initialData.workflow} />}
                />
                <Tab
                    id={'job'}
                    title={t('Job')}
                    panel={<InterfaceCreatorPanel type={'job'} data={initialData.job} isEditing={!!initialData.job} />}
                />
            </Tabs>
        </Box>
    );
};

export default compose(
    withTextContext(),
    withInitialDataConsumer()
)(CreateInterface);
