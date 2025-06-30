import { getApiUrl, getSecretKey } from '../config';

interface initializeAgentProps {
  model: string;
  provider: string;
}

export async function initializeAgent({ model, provider }: initializeAgentProps) {
  const [apiUrl, secretKey] = await Promise.all([
    getApiUrl('/agent/update_provider'),
    getSecretKey(),
  ]);

  const response = await fetch(apiUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Secret-Key': secretKey,
    },
    body: JSON.stringify({
      provider: provider.toLowerCase().replace(/ /g, '_'),
      model: model,
    }),
  });
  return response;
}
