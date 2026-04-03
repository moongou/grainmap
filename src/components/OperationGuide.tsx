import { MapPin, Image, Folder, Keyboard, Edit3, Eye, MousePointer2 } from 'lucide-react';

interface GuideSection {
  title: string;
  icon: React.ReactNode;
  items: { title: string; description: string }[];
}

const sections: GuideSection[] = [
  {
    title: '地图浏览',
    icon: <MapPin className="w-5 h-5" />,
    items: [
      { title: '地图缩放', description: '使用鼠标滚轮可以放大或缩小地图。在地图上双击可放大。' },
      { title: '地图平移', description: '点击并拖动地图可以平移查看不同区域。' },
      { title: '切换地图类型', description: '点击左下角的"标准"或"卫星"按钮可以在普通地图和卫星影像之间切换。' },
      { title: '查看照片位置', description: '地图上的标记点代表照片位置。点击标记可以查看照片详情。' },
    ],
  },
  {
    title: '照片管理',
    icon: <Image className="w-5 h-5" />,
    items: [
      { title: '添加照片', description: '点击侧边栏中的"添加照片"按钮，选择本地照片文件。支持多选，可以一次导入多张照片。' },
      { title: '编辑照片', description: '点击照片列表中的照片，或在地图上点击照片标记，然后点击"编辑"按钮进入编辑模式。' },
      { title: '删除照片', description: '在照片详情页或编辑页面，点击"删除"按钮即可删除照片。删除前会提示确认。' },
      { title: '移动到相册', description: '在照片详情页，可以更改照片所属的相册。从下拉菜单中选择目标相册即可。' },
    ],
  },
  {
    title: '相册管理',
    icon: <Folder className="w-5 h-5" />,
    items: [
      { title: '创建相册', description: '在侧边栏相册列表下方，点击"+"按钮可以创建新相册。输入相册名称和描述后保存。' },
      { title: '编辑相册', description: '鼠标悬停在相册名称上，会显示编辑和删除按钮。点击编辑按钮可以修改相册信息。' },
      { title: '删除相册', description: '点击相册上的删除按钮会删除相册，但相册中的照片不会丢失，会变为"未分类"。' },
      { title: '按相册筛选', description: '点击侧边栏中的相册名称，可以筛选显示该相册中的照片。点击"全部照片"可查看所有照片。' },
    ],
  },
  {
    title: '浏览相册',
    icon: <Eye className="w-5 h-5" />,
    items: [
      { title: '打开浏览相册', description: '在地图上点击照片标记，或在照片列表中点击照片，即可打开浏览相册。' },
      { title: '照片导航', description: '使用键盘的左右方向键可以切换上一张/下一张照片。也可以点击照片两侧的箭头按钮。' },
      { title: '照片与地图切换', description: '点击“切换主视图”按钮，或使用 Ctrl/Cmd + ↑ / ↓，可以互换照片和地图的主显示区域。' },
      { title: '全屏模式', description: '按 F 键或点击全屏按钮，可以让当前主显示内容（照片或地图）扩展到整个窗口。' },
      { title: '快速缩略图导航', description: '浏览相册顶部的缩略图条显示所有照片。点击任意缩略图可快速跳转到对应照片。' },
      { title: '排序方式', description: '点击排序按钮可以选择照片排序方式：按照片顺序（创建时间）、随机排序、或按距离（距当前照片最近）。' },
    ],
  },
  {
    title: '编辑模式',
    icon: <Edit3 className="w-5 h-5" />,
    items: [
      { title: '进入编辑模式', description: '在浏览相册中点击"编辑"按钮，或在照片详情页点击"编辑"按钮，即可进入编辑模式。' },
      { title: '修改照片信息', description: '在编辑模式左侧面板，可以修改照片的标题、描述、拍摄日期、所属相册等信息。' },
      { title: '调整照片位置', description: '在右侧地图上点击新位置，即可更新照片的经纬度坐标。也可以直接输入坐标值。' },
      { title: 'AI 文案生成', description: '点击"使用 AI 生成文案"按钮，系统会根据照片信息自动生成描述文案。' },
      { title: '保存更改', description: '编辑完成后，点击"保存"按钮提交更改。点击"取消"按钮放弃所有未保存的更改。' },
    ],
  },
  {
    title: '快捷键',
    icon: <Keyboard className="w-5 h-5" />,
    items: [
      { title: '← / →', description: '在浏览相册中切换上一张/下一张照片。' },
      { title: 'Ctrl/Cmd + ↑ / ↓', description: '在浏览相册中切换照片与地图的主视图。' },
      { title: 'F', description: '在浏览相册中切换全屏模式。' },
      { title: 'ESC', description: '关闭当前弹窗、退出全屏模式，或返回上一级界面。' },
    ],
  },
];

export default function OperationGuide() {
  return (
    <div className="h-full overflow-y-auto">
      <div className="max-w-4xl mx-auto p-8">
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-gray-900 mb-2">操作指引</h1>
          <p className="text-gray-600">本页面介绍 Grainmap 照片地图应用的各种功能和使用方法。</p>
        </div>

        <div className="space-y-8">
          {sections.map((section, index) => (
            <div key={index} className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
              <div className="px-6 py-4 bg-gray-50 border-b border-gray-200 flex items-center gap-3">
                <div className="text-primary-600">{section.icon}</div>
                <h2 className="text-lg font-bold text-gray-900">{section.title}</h2>
              </div>
              <div className="p-6 space-y-4">
                {section.items.map((item, itemIndex) => (
                  <div key={itemIndex} className="flex gap-4">
                    <div className="flex-shrink-0 w-2 h-2 rounded-full bg-primary-500 mt-2" />
                    <div>
                      <h3 className="font-semibold text-gray-900 mb-1">{item.title}</h3>
                      <p className="text-sm text-gray-600 leading-relaxed">{item.description}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        <div className="mt-8 p-6 bg-primary-50 rounded-2xl border border-primary-100">
          <h3 className="font-bold text-primary-900 mb-2 flex items-center gap-2">
            <MousePointer2 className="w-5 h-5" />
            提示
          </h3>
          <p className="text-sm text-primary-800 leading-relaxed">
            Grainmap 是一款结合照片管理和地图浏览的应用。您可以在一张交互式地图上组织和查看您的照片，
            支持按相册分类、AI 文案生成、多种排序方式等功能。让您的照片故事更加生动直观。
          </p>
        </div>
      </div>
    </div>
  );
}
