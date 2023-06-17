import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { SendMessageCommand, SQSClient } from '@aws-sdk/client-sqs';
import { v4 } from 'uuid';
import { S3Client, PutObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';

/**
 *
 * Event doc: https://docs.aws.amazon.com/apigateway/latest/developerguide/set-up-lambda-proxy-integrations.html#api-gateway-simple-proxy-for-lambda-input-format
 * @param {Object} event - API Gateway Lambda Proxy Input Format
 *
 * Return doc: https://docs.aws.amazon.com/apigateway/latest/developerguide/set-up-lambda-proxy-integrations.html
 * @returns {Object} object - API Gateway Lambda Proxy Output Format
 *
 */

const sqsClient = new SQSClient({});
const SQS_QUEUE_URL = process.env.SQS_QUEUE_URL || '';

const s3Client = new S3Client({});
const S3_BUCKET_NAME = process.env.S3_BUCKET_NAME || '';

export const handleGet = async function handleGet(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
    // URL is in format {host}/plan/{planId}
    const { pathParameters } = event;
    const { planId } = pathParameters || {};

    if (!planId) return { statusCode: 400, body: 'Missing planId' };

    // Step 1 - Check if planId exists in S3
    try {
        const command = new GetObjectCommand({
            Bucket: S3_BUCKET_NAME,
            Key: planId,
        });
        const response = await s3Client.send(command);

        const body = await response.Body?.transformToString();

        const { status, plan } = JSON.parse(body || '{}') as { status: string; plan: Record<string, unknown> };

        // If status is pending, return 202
        if (status === 'pending') {
            return { statusCode: 202, body: JSON.stringify({ message: 'Plan is being generated' }) };
        }

        // If status is complete, return 200
        if (status === 'complete') {
            return { statusCode: 200, body: JSON.stringify({ plan }) };
        }

        // If status is error, return 500
        if (status === 'error') {
            return { statusCode: 429, body: JSON.stringify({ message: 'Plan generation failed, try again' }) };
        }
    } catch (e) {
        // If it doesn't exist, return 404
        if (typeof e === 'object' && !!e && 'name' in e && e.name === 'NoSuchKey') {
            return { statusCode: 404, body: JSON.stringify({ message: 'Plan not found' }) };
        }
        return { statusCode: 500, body: JSON.stringify({ message: e }) };
    }

    return { statusCode: 500, body: JSON.stringify({ message: 'Something went wrong' }) };
};

async function handlePost(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
    // Body is the questionaire results, which should be published to the queue
    const { body: bodyString } = event;

    if (!bodyString) return { statusCode: 400, body: 'Missing body' };
    const { answers, userId } = JSON.parse(bodyString);
    const uuid = `pl-${v4()}`;

    // Write { status: 'pending' } to S3
    const s3Command = new PutObjectCommand({
        Bucket: S3_BUCKET_NAME,
        Key: uuid,
        Body: JSON.stringify({ status: 'pending' }),
    });

    const command = new SendMessageCommand({
        QueueUrl: SQS_QUEUE_URL,
        MessageAttributes: {},
        MessageDeduplicationId: uuid,
        MessageBody: JSON.stringify({
            answers,
            userId,
            uuid,
        }),
    });
    const [response] = await Promise.all([sqsClient.send(command), s3Client.send(s3Command)]);

    return {
        statusCode: 200,
        body: JSON.stringify({
            planId: uuid,
            messageId: response.MessageId,
        }),
    };
}

export const lambdaHandler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
    try {
        const { httpMethod } = event;

        if (httpMethod === 'GET') {
            return handleGet(event);
        }

        if (httpMethod === 'POST') {
            return handlePost(event);
        }

        return { statusCode: 405, body: 'Method not allowed' };
    } catch (err) {
        console.log(err);
        return {
            statusCode: 500,
            body: JSON.stringify({
                message: 'some error happened',
                err,
            }),
        };
    }
};
