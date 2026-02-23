import React from 'react';
import { useTranslation } from 'react-i18next';
import { Mail, MessageSquare, ExternalLink } from 'lucide-react';

const HelpTab: React.FC = () => {
    const { t } = useTranslation();

    return (
        <div className="space-y-6">
            <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 p-6">
                <h2 className="text-xl font-bold text-slate-800 dark:text-white mb-4 flex items-center gap-2">
                    <MessageSquare className="w-6 h-6 text-blue-500" />
                    {t('settings.help.title')}
                </h2>

                <p className="text-slate-600 dark:text-slate-400 mb-6">
                    {t('settings.help.description')}
                </p>

                <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-100 dark:border-blue-800 rounded-lg p-5">
                    <h3 className="font-semibold text-slate-800 dark:text-gray-200 mb-2 flex items-center gap-2">
                        <Mail className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                        {t('settings.help.contact_support')}
                    </h3>
                    <p className="text-sm text-slate-500 dark:text-slate-400 mb-3">
                        {t('settings.help.email_desc')}
                    </p>
                    <a
                        href="mailto:techsolutionsepoint@gmail.com"
                        className="inline-flex items-center gap-2 text-lg font-medium text-blue-600 dark:text-blue-400 hover:text-blue-700 hover:underline"
                    >
                        techsolutionsepoint@gmail.com
                        <ExternalLink size={16} />
                    </a>
                </div>
            </div>
        </div>
    );
};

export default HelpTab;
