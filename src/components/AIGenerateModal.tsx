import { useState } from 'react';
import { X, Sparkles, Loader2, Wand2 } from 'lucide-react';

interface AIGenerateModalProps {
  userId: string;
  photoTitle: string;
  photoDescription: string;
  onClose: () => void;
  onGenerate: (text: string) => void;
}

const GENERATION_STYLES = [
  { id: 'poem', name: '诗词风格', description: '生成一首优美的诗词' },
  { id: 'story', name: '故事风格', description: '讲述照片背后的故事' },
  { id: 'prose', name: '散文风格', description: '优美的散文描述' },
  { id: 'concise', name: '简洁风格', description: '简短精炼的描述' },
];

function AIGenerateModal({ userId, photoTitle, photoDescription, onClose, onGenerate }: AIGenerateModalProps) {
  const [style, setStyle] = useState('poem');

  if (!window.electronAPI) {
    return <div className="p-10 text-center text-red-600">错误：环境不可用</div>;
  }

  const [customPrompt, setCustomPrompt] = useState('');
  const [loading, setLoading] = useState(false);
  const [generatedText, setGeneratedText] = useState('');
  const [error, setError] = useState('');

  const handleGenerate = async () => {
    setLoading(true);
    setError('');

    try {
      // 获取AI配置
      const config = await window.electronAPI.db.getAIConfig(userId);
      
      if (!config) {
        setError('请先配置AI设置');
        setLoading(false);
        return;
      }

      // 构建提示词
      let prompt = '';
      switch (style) {
        case 'poem':
          prompt = `为这张照片创作一首优美的诗词。照片标题：${photoTitle}。${photoDescription ? '照片描述：' + photoDescription : ''}`;
          break;
        case 'story':
          prompt = `为这张照片写一段故事。照片标题：${photoTitle}。${photoDescription ? '照片描述：' + photoDescription : ''}`;
          break;
        case 'prose':
          prompt = `为这张照片写一段优美的散文。照片标题：${photoTitle}。${photoDescription ? '照片描述：' + photoDescription : ''}`;
          break;
        case 'concise':
          prompt = `为这张照片写一段简短精炼的描述。照片标题：${photoTitle}。${photoDescription ? '照片描述：' + photoDescription : ''}`;
          break;
        default:
          prompt = customPrompt;
      }

      // 调用AI API
      let response;
      if (config.provider === 'openai' || config.provider === 'volcano') {
        response = await callOpenAI(config.apiKey, config.apiUrl, config.model, prompt);
      } else if (config.provider === 'claude') {
        response = await callClaude(config.apiKey, config.apiUrl, config.model, prompt);
      } else if (config.provider === 'ollama') {
        response = await callOllama(config.apiUrl, config.model, prompt);
      } else {
        response = await callCustomAPI(config.apiUrl, config.apiKey, prompt);
      }

      setGeneratedText(response);
    } catch (err) {
      setError('生成失败，请检查AI配置');
      console.error('AI generation error:', err);
    } finally {
      setLoading(false);
    }
  };

  const callOpenAI = async (apiKey: string, apiUrl: string, model: string, prompt: string) => {
    const url = apiUrl || 'https://api.openai.com/v1/chat/completions';
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: model || 'gpt-3.5-turbo',
        messages: [
          { role: 'system', content: '你是一个专业的文案创作者，擅长为照片创作优美的文字。' },
          { role: 'user', content: prompt },
        ],
        temperature: 0.8,
        max_tokens: 500,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error?.message || 'OpenAI/Volcano API error');
    }

    const data = await response.json();
    return data.choices[0].message.content;
  };

  const callClaude = async (apiKey: string, apiUrl: string, model: string, prompt: string) => {
    const url = apiUrl || 'https://api.anthropic.com/v1/messages';
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: model || 'claude-3-haiku-20240307',
        max_tokens: 500,
        messages: [
          { role: 'user', content: prompt },
        ],
      }),
    });

    if (!response.ok) {
      throw new Error('Claude API error');
    }

    const data = await response.json();
    return data.content[0].text;
  };

  const callOllama = async (apiUrl: string, model: string, prompt: string) => {
    const url = apiUrl || 'http://localhost:11434/api/chat';
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: model || 'llama3',
        messages: [
          { role: 'system', content: '你是一个专业的文案创作者，擅长为照片创作优美的文字。' },
          { role: 'user', content: prompt },
        ],
        stream: false,
      }),
    });

    if (!response.ok) {
      throw new Error('Ollama API error');
    }

    const data = await response.json();
    return data.message.content;
  };

  const callCustomAPI = async (apiUrl: string, apiKey: string, prompt: string) => {
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        prompt,
        max_tokens: 500,
      }),
    });

    if (!response.ok) {
      throw new Error('Custom API error');
    }

    const data = await response.json();
    return data.text || data.response || data.content || data.message;
  };

  const handleUseText = () => {
    if (generatedText) {
      onGenerate(generatedText);
    }
  };

  const handleRegenerate = () => {
    setGeneratedText('');
    handleGenerate();
  };

  return (
    <div className="photo-modal-overlay" onClick={onClose}>
      <div 
        className="photo-modal-content w-full max-w-lg max-h-[90vh] overflow-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-6">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center">
              <Wand2 className="w-6 h-6 text-primary-600 mr-2" />
              <h2 className="text-xl font-bold text-gray-900">AI生成文案</h2>
            </div>
            <button
              onClick={onClose}
              className="p-1 text-gray-400 hover:text-gray-600"
            >
              <X className="w-6 h-6" />
            </button>
          </div>

          {!generatedText ? (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  选择生成风格
                </label>
                <div className="grid grid-cols-2 gap-3">
                  {GENERATION_STYLES.map((s) => (
                    <button
                      key={s.id}
                      onClick={() => setStyle(s.id)}
                      className={`p-3 rounded-lg border-2 text-left transition-colors ${
                        style === s.id
                          ? 'border-primary-500 bg-primary-50'
                          : 'border-gray-200 hover:border-gray-300'
                      }`}
                    >
                      <div className="font-medium text-gray-900">{s.name}</div>
                      <div className="text-xs text-gray-500 mt-1">{s.description}</div>
                    </button>
                  ))}
                </div>
              </div>

              {style === 'custom' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    自定义提示词
                  </label>
                  <textarea
                    value={customPrompt}
                    onChange={(e) => setCustomPrompt(e.target.value)}
                    className="input-field h-24 resize-none"
                    placeholder="输入你的自定义提示词..."
                  />
                </div>
              )}

              {error && (
                <div className="text-red-600 text-sm bg-red-50 p-3 rounded-lg">
                  {error}
                </div>
              )}

              <button
                onClick={handleGenerate}
                disabled={loading}
                className="w-full btn-primary flex items-center justify-center"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    生成中...
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4 mr-2" />
                    生成文案
                  </>
                )}
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="bg-gradient-to-r from-primary-50 to-purple-50 rounded-lg p-4">
                <div className="flex items-center mb-2">
                  <Sparkles className="w-5 h-5 text-primary-600 mr-2" />
                  <span className="text-sm font-medium text-primary-700">生成的文案</span>
                </div>
                <p className="text-gray-700 leading-relaxed whitespace-pre-wrap">
                  {generatedText}
                </p>
              </div>

              <div className="flex space-x-3">
                <button
                  onClick={handleRegenerate}
                  className="flex-1 btn-secondary flex items-center justify-center"
                >
                  <Sparkles className="w-4 h-4 mr-2" />
                  重新生成
                </button>
                <button
                  onClick={handleUseText}
                  className="flex-1 btn-primary flex items-center justify-center"
                >
                  使用此文案
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default AIGenerateModal;
