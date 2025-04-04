import React from 'react';
import { Link } from 'react-router-dom';
import PageLayout from '../components/common/PageLayout';
import Card from '../components/common/Card';

/**
 * Design System page for Gam(e)Bit
 * Provides navigation to all component showcase pages
 */
const DesignSystem: React.FC = () => {
  // Component categories with their showcase pages
  const componentCategories = [
    {
      title: 'Core Components',
      description: 'Fundamental building blocks for the Gam(e)Bit interface',
      components: [
        { name: 'Cards', path: '/design/cards', description: 'Container components for grouping related content' },
        { name: 'Buttons', path: '/design/buttons', description: 'Interactive elements for user actions' },
        { name: 'Typography', path: '/design/typography', description: 'Text styles and hierarchies' },
      ]
    },
    {
      title: 'Layout Components',
      description: 'Components for structuring page layouts',
      components: [
        { name: 'Navigation', path: '/design/navigation', description: 'App navigation and menus' },
        { name: 'PageLayout', path: '/design/layouts', description: 'Page structure components' },
        { name: 'Footer', path: '/design/footer', description: 'Footer components and variations' },
      ]
    },
    {
      title: 'Form Components',
      description: 'Components for user input and form creation',
      components: [
        { name: 'Input Fields', path: '/design/inputs', description: 'Text inputs and form controls' },
        { name: 'Toggles & Checkboxes', path: '/design/toggles', description: 'Interactive selection controls' },
        { name: 'Form Layouts', path: '/design/forms', description: 'Complete form patterns and layouts' },
      ]
    },
    {
      title: 'Feedback Components',
      description: 'Components for user feedback and notifications',
      components: [
        { name: 'Loaders', path: '/design/loaders', description: 'Loading indicators and spinners' },
        { name: 'Alerts', path: '/design/alerts', description: 'Notification and alert components' },
        { name: 'Modals', path: '/design/modals', description: 'Dialog and modal window components' },
      ]
    }
  ];

  return (
    <PageLayout>
      <div className="container mx-auto py-8 px-4">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-deep-purple mb-2">Gam(e)Bit Design System</h1>
          <p className="text-lg text-muted-violet">
            A comprehensive collection of UI components, patterns, and guidelines that ensure consistency across the Gam(e)Bit platform.
          </p>
        </div>

        {/* Color Palette Section */}
        <div className="mb-12">
          <h2 className="text-2xl font-bold text-deep-purple mb-4">Color Palette</h2>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            <div className="flex flex-col">
              <div className="h-24 bg-deep-purple rounded-t-lg"></div>
              <div className="bg-white p-3 rounded-b-lg border border-gray-200">
                <p className="font-medium">Deep Purple</p>
                <p className="text-xs text-gray-500">#231942</p>
              </div>
            </div>
            <div className="flex flex-col">
              <div className="h-24 bg-soft-pink rounded-t-lg"></div>
              <div className="bg-white p-3 rounded-b-lg border border-gray-200">
                <p className="font-medium">Soft Pink</p>
                <p className="text-xs text-gray-500">#E0B1CB</p>
              </div>
            </div>
            <div className="flex flex-col">
              <div className="h-24 bg-muted-violet rounded-t-lg"></div>
              <div className="bg-white p-3 rounded-b-lg border border-gray-200">
                <p className="font-medium">Muted Violet</p>
                <p className="text-xs text-gray-500">#5E548E</p>
              </div>
            </div>
            <div className="flex flex-col">
              <div className="h-24 bg-soft-lavender rounded-t-lg"></div>
              <div className="bg-white p-3 rounded-b-lg border border-gray-200">
                <p className="font-medium">Soft Lavender</p>
                <p className="text-xs text-gray-500">#9F86C0</p>
              </div>
            </div>
            <div className="flex flex-col">
              <div className="h-24 bg-off-white rounded-t-lg"></div>
              <div className="bg-white p-3 rounded-b-lg border border-gray-200">
                <p className="font-medium">Off White</p>
                <p className="text-xs text-gray-500">#FEF3FF</p>
              </div>
            </div>
          </div>
        </div>

        {/* Component Categories */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {componentCategories.map((category, index) => (
            <Card
              key={index}
              title={category.title}
              subtitle={category.description}
              variant={index % 2 === 0 ? 'default' : 'outlined'}
            >
              <div className="space-y-3">
                {category.components.map((component, cIndex) => (
                  <div key={cIndex} className="border-b border-gray-100 last:border-b-0 pb-3 last:pb-0">
                    <Link
                      to={component.path}
                      className="flex justify-between items-center group"
                    >
                      <div>
                        <h3 className="font-medium text-muted-violet group-hover:text-deep-purple transition-colors">{component.name}</h3>
                        <p className="text-sm text-gray-500">{component.description}</p>
                      </div>
                      <div className="text-soft-pink opacity-0 group-hover:opacity-100 transition-opacity">
                        <i className="fas fa-arrow-right"></i>
                      </div>
                    </Link>
                  </div>
                ))}
              </div>
            </Card>
          ))}
        </div>

        {/* Design Principles Section */}
        <div className="mt-12">
          <h2 className="text-2xl font-bold text-deep-purple mb-4">Design Principles</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <Card>
              <div className="text-center mb-4">
                <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-soft-lavender/20 text-deep-purple mb-3">
                  <i className="fas fa-universal-access text-2xl"></i>
                </div>
                <h3 className="text-xl font-bold text-deep-purple">Accessible</h3>
              </div>
              <p className="text-center text-gray-700">
                Designs follow accessibility best practices to ensure all users can interact with the platform regardless of abilities.
              </p>
            </Card>

            <Card>
              <div className="text-center mb-4">
                <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-soft-lavender/20 text-deep-purple mb-3">
                  <i className="fas fa-mobile-alt text-2xl"></i>
                </div>
                <h3 className="text-xl font-bold text-deep-purple">Responsive</h3>
              </div>
              <p className="text-center text-gray-700">
                Components adapt seamlessly to different screen sizes, ensuring a consistent experience across devices.
              </p>
            </Card>

            <Card>
              <div className="text-center mb-4">
                <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-soft-lavender/20 text-deep-purple mb-3">
                  <i className="fas fa-layer-group text-2xl"></i>
                </div>
                <h3 className="text-xl font-bold text-deep-purple">Modular</h3>
              </div>
              <p className="text-center text-gray-700">
                The design system uses composable components that can be combined to create complex interfaces.
              </p>
            </Card>
          </div>
        </div>
      </div>
    </PageLayout>
  );
};

export default DesignSystem; 