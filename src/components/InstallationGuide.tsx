import { useState } from 'react';
import { X, ArrowRight, Check } from 'lucide-react';

interface InstallationGuideProps {
  onClose: () => void;
}

function InstallationGuide({ onClose }: InstallationGuideProps) {
  const [currentStep, setCurrentStep] = useState(0);

  const steps = [
    {
      title: '欢迎使用 Grainmap',
      description: 'Grainmap 是一个照片地图应用，让你可以在地图上标记和记录你的照片故事。',
      image: '/assets/installation-guide.png',
    },
    {
      title: '配置高德地图 API Key',
      description: '请在设置中配置你的高德地图 API Key，以使用地图功能。',
      image: '/assets/installation-guide.png',
    },
    {
      title: '配置 AI 文案生成',
      description: '在设置页面配置 AI 提供商和 API Key，以使用 AI 生成文案功能。',
      image: '/assets/installation-guide.png',
    },
    {
      title: '开始使用',
      description: '点击添加按钮上传照片，并在地图上标记位置。',
      image: '/assets/installation-guide.png',
    },
  ];

  const handleNext = () => {
    if (currentStep < steps.length - 1) {
      setCurrentStep(currentStep + 1);
    } else {
      onClose();
    }
  };

  const handlePrev = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b">
          <h2 className="text-xl font-bold text-gray-900">安装指引</h2>
          <button
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-gray-600"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6">
          <div className="flex items-center mb-6">
            {steps.map((_, index) => (
              <div
                key={index}
                className={`flex-1 h-1 ${index <= currentStep ? 'bg-primary-600' : 'bg-gray-200'}`}
              />
            ))}
          </div>

          <div className="text-center mb-8">
            <img
              src={steps[currentStep].image}
              alt={steps[currentStep].title}
              className="w-64 h-48 object-cover rounded-lg mx-auto mb-6"
            />
            <h3 className="text-lg font-semibold text-gray-900 mb-2">
              {steps[currentStep].title}
            </h3>
            <p className="text-gray-600">{steps[currentStep].description}</p>
          </div>

          <div className="flex items-center justify-between">
            <button
              onClick={handlePrev}
              disabled={currentStep === 0}
              className="px-4 py-2 text-gray-600 hover:text-gray-900 disabled:opacity-50"
            >
              上一步
            </button>
            <div className="flex items-center space-x-2">
              {steps.map((_, index) => (
                <button
                  key={index}
                  onClick={() => setCurrentStep(index)}
                  className={`w-3 h-3 rounded-full ${index === currentStep ? 'bg-primary-600' : 'bg-gray-300'}`}
                />
              ))}
            </div>
            <button
              onClick={handleNext}
              className="px-6 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 flex items-center"
            >
              {currentStep === steps.length - 1 ? (
                <>
                  <Check className="w-4 h-4 mr-2" />
                  完成
                </>
              ) : (
                <>
                  下一步
                  <ArrowRight className="w-4 h-4 ml-2" />
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default InstallationGuide;
