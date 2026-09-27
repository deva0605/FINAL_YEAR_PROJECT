import React from 'react';

export const Settings: React.FC = () => {
  return (
    <div className="flex flex-col gap-6 max-w-2xl">
      <h2 className="text-display-sm font-bold text-on-surface mb-2">Settings</h2>
      
      <div className="bg-surface-container-low p-6 rounded-xl border border-outline-variant/20">
        <h3 className="text-title-lg font-bold text-on-surface mb-4">Account</h3>
        <div className="flex flex-col gap-4">
          <div className="flex justify-between items-center pb-4 border-b border-outline-variant/20">
            <div>
              <div className="font-bold">Plan</div>
              <div className="text-sm text-on-surface-variant">Pro Analyst Plan</div>
            </div>
            <button className="px-4 py-2 bg-surface-container-high rounded-lg text-sm font-bold hover:bg-surface-variant">Manage</button>
          </div>
          
          <div className="flex justify-between items-center">
            <div>
              <div className="font-bold">API Key</div>
              <div className="text-sm text-on-surface-variant">Used for custom integrations</div>
            </div>
            <button className="px-4 py-2 bg-surface-container-high rounded-lg text-sm font-bold hover:bg-surface-variant">Reveal</button>
          </div>
        </div>
      </div>

      <div className="bg-surface-container-low p-6 rounded-xl border border-outline-variant/20">
        <h3 className="text-title-lg font-bold text-on-surface mb-4">Preferences</h3>
        <div className="flex flex-col gap-4">
          <div className="flex justify-between items-center pb-4 border-b border-outline-variant/20">
            <div>
              <div className="font-bold">Default Horizon</div>
              <div className="text-sm text-on-surface-variant">Strategy agent default view</div>
            </div>
            <select className="px-3 py-2 bg-surface-container-lowest border border-outline-variant/30 rounded-lg text-sm">
              <option>Short Term (1-3 Mo)</option>
              <option selected>Medium Term (6-12 Mo)</option>
              <option>Long Term (1-3 Yr)</option>
            </select>
          </div>
          
          <div className="flex justify-between items-center">
            <div>
              <div className="font-bold">Risk Tolerance</div>
              <div className="text-sm text-on-surface-variant">Affects decision agent recommendations</div>
            </div>
            <select className="px-3 py-2 bg-surface-container-lowest border border-outline-variant/30 rounded-lg text-sm">
              <option>Conservative</option>
              <option selected>Balanced</option>
              <option>Aggressive</option>
            </select>
          </div>
        </div>
      </div>
    </div>
  );
};
