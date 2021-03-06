export const types_with_version = ['step', 'mapper'];
export const types_without_version = ['service', 'job', 'workflow', 'config-item-values', 'config-items',
                               'class', 'constant', 'function', 'connection', 'event', 'group',
                               'queue', 'value-map', 'mapper-code', 'type'];
export const types = [...types_with_version, ...types_without_version];

export const root_service = 'QorusService';
export const root_job = 'QorusJob';
export const root_workflow = 'QorusWorkflow';
export const root_steps = ['QorusAsyncStep', 'QorusEventStep', 'QorusNormalStep', 'QorusSubworkflowStep',
                           'QorusAsyncArrayStep', 'QorusEventArrayStep',
                           'QorusNormalArrayStep', 'QorusSubworkflowArrayStep'];
export const all_root_classes = [...root_steps, root_service, root_job, root_workflow];

export const default_version = '1.0';
