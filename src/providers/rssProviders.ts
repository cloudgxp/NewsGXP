import { BaseRssProvider } from './rssProvider';

// --- Frontier Labs ---

// 1. OpenAI Research
export const openAiResearchProvider = new BaseRssProvider({
  id: 'openai-research',
  name: 'OpenAI Research',
  topic: 'Frontier Labs',
  description: 'Frontier AI research publications, safety evaluations, reasoning benchmarks, and papers from OpenAI.',
  homepage: 'https://openai.com/research/',
  icon: 'https://www.google.com/s2/favicons?domain=openai.com&sz=64',
  categories: ['AI', 'Research', 'Frontier Models'],
  filterFn: (art) => {
    const text = `${art.title} ${art.url} ${art.summary || ''} ${(art.categories || []).join(' ')}`.toLowerCase();
    return (
      art.url.includes('/research') ||
      art.url.includes('/index/') ||
      text.includes('research') ||
      text.includes('paper') ||
      text.includes('model') ||
      text.includes('gpt') ||
      text.includes('safety') ||
      text.includes('benchmark')
    );
  },
});

// 2. Google AI Blog
export const googleAiProvider = new BaseRssProvider({
  id: 'google-ai',
  name: 'Google AI Blog',
  topic: 'Frontier Labs',
  description: 'Official artificial intelligence research, announcements, and innovation updates from Google.',
  homepage: 'https://blog.google/innovation-and-ai/technology/ai/',
  icon: 'https://www.google.com/s2/favicons?domain=blog.google&sz=64',
  categories: ['AI', 'Google', 'Research', 'Innovation'],
});

// 3. Google Gemini Updates
export const googleGeminiProvider = new BaseRssProvider({
  id: 'google-gemini',
  name: 'Google Gemini',
  topic: 'Frontier Labs',
  description: 'New model announcements, multimodal capabilities, and product features for Google Gemini.',
  homepage: 'https://blog.google/products-and-platforms/products/gemini/',
  icon: 'https://www.google.com/s2/favicons?domain=blog.google&sz=64',
  categories: ['AI', 'Gemini', 'Multimodal', 'Google'],
});

// 4. Google DeepMind
export const googleDeepMindProvider = new BaseRssProvider({
  id: 'google-deepmind',
  name: 'Google DeepMind',
  topic: 'Frontier Labs',
  description: 'Pioneering artificial intelligence research, scientific discoveries, and breakthrough models from Google DeepMind.',
  homepage: 'https://deepmind.google/discover/blog/',
  icon: 'https://www.google.com/s2/favicons?domain=deepmind.google&sz=64',
  categories: ['AI', 'DeepMind', 'Research', 'Science'],
});

// 5. Mistral AI
export const mistralProvider = new BaseRssProvider({
  id: 'mistral',
  name: 'Mistral AI',
  topic: 'Frontier Labs',
  description: 'Open-weight foundation models, enterprise AI developments, and releases from Mistral AI.',
  homepage: 'https://mistral.ai/news/',
  icon: 'https://www.google.com/s2/favicons?domain=mistral.ai&sz=64',
  categories: ['AI', 'Open Source', 'LLMs', 'Frontier Models'],
});

// --- Cloud & Engineering ---

// 6. GitHub Blog
export const githubBlogProvider = new BaseRssProvider({
  id: 'github-blog',
  name: 'GitHub Blog',
  topic: 'Cloud & Engineering',
  description: 'News, updates, and stories about software development, open source, AI developer tooling, and GitHub.',
  homepage: 'https://github.blog/',
  icon: 'https://www.google.com/s2/favicons?domain=github.blog&sz=64',
  categories: ['Technology', 'Developer Tools', 'GitHub', 'Open Source'],
});

// 7. GitHub Changelog
export const githubChangelogProvider = new BaseRssProvider({
  id: 'github-changelog',
  name: 'GitHub Changelog',
  topic: 'Cloud & Engineering',
  description: 'Official feature releases, breaking changes, and updates across GitHub platforms and Copilot.',
  homepage: 'https://github.blog/changelog/',
  icon: 'https://www.google.com/s2/favicons?domain=github.blog&sz=64',
  categories: ['Technology', 'Changelog', 'GitHub Copilot'],
});

// 8. Google Developers Blog
export const googleDevelopersProvider = new BaseRssProvider({
  id: 'google-developers',
  name: 'Google Developers Blog',
  topic: 'Cloud & Engineering',
  description: 'Technical announcements, SDK releases, developer tools, and APIs from Google.',
  homepage: 'https://developers.googleblog.com/',
  icon: 'https://www.google.com/s2/favicons?domain=developers.googleblog.com&sz=64',
  categories: ['Technology', 'Developer Tools', 'APIs', 'Google'],
});

// 9. Microsoft AI Blog
export const microsoftAiProvider = new BaseRssProvider({
  id: 'microsoft-ai',
  name: 'Microsoft AI Blog',
  topic: 'Cloud & Engineering',
  description: 'Enterprise artificial intelligence, Copilot innovations, and responsible AI leadership from Microsoft.',
  homepage: 'https://blogs.microsoft.com/ai/',
  icon: 'https://www.google.com/s2/favicons?domain=microsoft.com&sz=64',
  categories: ['AI', 'Microsoft', 'Copilot', 'Enterprise AI'],
});

// 10. Azure AI Foundry
export const azureFoundryProvider = new BaseRssProvider({
  id: 'azure-foundry',
  name: 'Azure AI Foundry',
  topic: 'Cloud & Engineering',
  description: 'Building, customizing, and scaling enterprise generative AI models and agents on Azure.',
  homepage: 'https://azure.microsoft.com/en-us/blog/product/microsoft-foundry/',
  icon: 'https://www.google.com/s2/favicons?domain=azure.microsoft.com&sz=64',
  categories: ['AI', 'Azure', 'Enterprise AI', 'Cloud'],
});

// 11. AWS Generative AI
export const awsGenAiProvider = new BaseRssProvider({
  id: 'aws-genai',
  name: 'AWS Generative AI',
  topic: 'Cloud & Engineering',
  description: 'Generative AI news, infrastructure developments, Bedrock capabilities, and AWS foundation models.',
  homepage: 'https://aws.amazon.com/blogs/aws/category/artificial-intelligence/generative-ai/',
  icon: 'https://www.google.com/s2/favicons?domain=aws.amazon.com&sz=64',
  categories: ['AI', 'AWS', 'Generative AI', 'Cloud'],
});

// 12. AWS Machine Learning
export const awsMlProvider = new BaseRssProvider({
  id: 'aws-ml',
  name: 'AWS Machine Learning',
  topic: 'Cloud & Engineering',
  description: 'Architectural deep dives, model fine-tuning guides, and machine learning solutions on AWS.',
  homepage: 'https://aws.amazon.com/blogs/machine-learning/category/artificial-intelligence/generative-ai/',
  icon: 'https://www.google.com/s2/favicons?domain=aws.amazon.com&sz=64',
  categories: ['AI', 'Machine Learning', 'AWS', 'Data Science'],
});

// 13. Hugging Face Blog
export const huggingFaceProvider = new BaseRssProvider({
  id: 'huggingface',
  name: 'Hugging Face Blog',
  topic: 'Cloud & Engineering',
  description: 'Open-source machine learning research, community datasets, and transformer model releases from Hugging Face.',
  homepage: 'https://huggingface.co/blog',
  icon: 'https://www.google.com/s2/favicons?domain=huggingface.co&sz=64',
  categories: ['AI', 'Open Source', 'Transformers', 'Community'],
});

// --- Hardware & Edge ---

// 14. NVIDIA Generative AI
export const nvidiaGenAiProvider = new BaseRssProvider({
  id: 'nvidia-genai',
  name: 'NVIDIA Generative AI',
  topic: 'Hardware & Edge',
  description: 'Generative AI hardware breakthroughs, enterprise deployments, and compute acceleration from NVIDIA.',
  homepage: 'https://blogs.nvidia.com/blog/category/generative-ai/',
  icon: 'https://www.google.com/s2/favicons?domain=nvidia.com&sz=64',
  categories: ['AI', 'NVIDIA', 'Hardware', 'Generative AI'],
});

// 15. NVIDIA Developer Blog
export const nvidiaDeveloperProvider = new BaseRssProvider({
  id: 'nvidia-developer',
  name: 'NVIDIA Developer Blog',
  topic: 'Hardware & Edge',
  description: 'Technical tutorials, CUDA optimizations, AI inference performance, and SDK guides for developers.',
  homepage: 'https://developer.nvidia.com/blog/',
  icon: 'https://www.google.com/s2/favicons?domain=developer.nvidia.com&sz=64',
  categories: ['Technology', 'GPU Compute', 'CUDA', 'Developer Tools'],
});

// --- Generative Media ---

// 16. Stability AI News
export const stabilityAiProvider = new BaseRssProvider({
  id: 'stability-ai',
  name: 'Stability AI News',
  topic: 'Generative Media',
  description: 'Open generative media models, Stable Diffusion research, and multimodal AI releases from Stability AI.',
  homepage: 'https://stability.ai/news',
  icon: 'https://www.google.com/s2/favicons?domain=stability.ai&sz=64',
  categories: ['AI', 'Diffusion Models', 'Media Generation', 'Open Weights'],
});
