export const MENU = {
    ProjectConfig: [
        {
            name: 'ProjectConfig',
            icon: 'home',
            tab: 'ProjectConfig',
        },
    ],
    ReleasePackage: [
        {
            name: 'ReleasePackage',
            icon: 'cube',
            tab: 'ReleasePackage',
        },
    ],
    DeleteInterfaces: [
        {
            name: 'DeleteInterfaces',
            icon: 'trash',
            tab: 'DeleteInterfaces',
        },
    ],
    CreateInterface: [
        {
            name: 'CreateInterface',
            icon: 'new-object',
            tab: 'CreateInterface',
            submenu: [
                { name: 'Workflow', icon: 'exchange', tab: 'CreateInterface', subtab: 'workflow' },
                { name: 'Service', icon: 'merge-links', tab: 'CreateInterface', subtab: 'service' },
                { name: 'Job', icon: 'calendar', tab: 'CreateInterface', subtab: 'job' },
                { name: 'Step', icon: 'diagram-tree', tab: 'CreateInterface', subtab: 'step' },
                { name: 'Class', icon: 'code-block', tab: 'CreateInterface', subtab: 'class' },
                { name: 'Mapper', icon: 'code-block', tab: 'CreateInterface', subtab: 'mapper' },
                { name: 'Other', icon: 'more', tab: 'CreateInterface', subtab: 'other' },
            ],
        },
    ],
};
