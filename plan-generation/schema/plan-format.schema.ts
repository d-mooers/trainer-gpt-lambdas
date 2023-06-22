const exerciseFormat = {
    type: 'object',
    properties: {
        name: {
            type: 'string',
        },
        description: {
            type: 'string',
        },
        reps: {
            type: 'number',
        },
        sets: {
            type: 'number',
        },
        rest: {
            type: 'number',
            description: 'Time in seconds between sets',
        },
    },
};

export const planFormat = {
    type: 'object',
    properties: {
        plan: {
            type: 'array',
            items: {
                type: 'object',
                properties: {
                    day: {
                        type: 'string',
                        // required: true
                    },
                    focus: {
                        type: 'string',
                        // required: true,
                        description: 'The muscle group(s) that the workout is focused on',
                    },
                    exercises: {
                        type: 'array',
                        items: exerciseFormat,
                    },
                },
            },
        },
    },
};
