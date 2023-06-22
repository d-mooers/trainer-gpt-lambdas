import { SQSEvent } from 'aws-lambda';
import { PlanGenerationSpec } from '../types';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { planFormat } from './schema/plan-format.schema';

const s3Client = new S3Client({});
const S3_BUCKET_NAME = process.env.S3_BUCKET_NAME || '';

export const lambdaHandler = async (event: SQSEvent): Promise<void> => {
    for (const record of event.Records) {
        const { body } = record;
        const payload = JSON.parse(body) as PlanGenerationSpec;

        const openAiPayload = {
            model: 'gpt-4-0613',
            messages: [
                {
                    role: 'system',
                    content: `Assistant is a world-renowned personal trainer and chef.  Assistant makes excellent workout plans tailored specifically to user needs.`,
                },
                {
                    role: 'assistant',
                    content:
                        'I am here to make you a specic workout plan, but I need some of your info first! Please provide your info as a JSON',
                },
                {
                    role: 'user',
                    content: JSON.stringify(payload.answers),
                },
                {
                    role: 'user',
                    content: `Use function call to generate my workout plan`,
                },
            ],
            functions: [
                {
                    name: 'create_weekly_workout_plan',
                    description:
                        'Accepts a json object that describes the workout plan for the week, and adds it to the user profile',
                    parameters: planFormat,
                },
            ],
            temperature: 1,
        };

        const query = await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: {
                'content-type': 'application/json',
                authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
            },
            body: JSON.stringify(openAiPayload),
        });

        if (!query.ok) {
            return;
        }

        const data = await query.json();

        const functionCall = data.choices[0].message?.function_call;
        const functionParameters = JSON.parse(functionCall?.arguments ?? '{}');

        const putPlanCommand = new PutObjectCommand({
            Bucket: S3_BUCKET_NAME,
            Key: payload.uuid,
            Body: JSON.stringify(functionParameters),
        });

        await s3Client.send(putPlanCommand);
    }
};
