/**
 * CommunityInfo — replaced the upstream "Golden Edition" upsell.
 *
 * Hey API is fully open-source and free. No paid tiers, no cloud subscription,
 * no telemetry. This panel gives users links to the project and contribution info.
 */
import React from 'react';
import Modal from 'components/Modal/index';
import StyledWrapper from './StyledWrapper';

const CommunityInfo = ({ onClose }) => {
  const features = [
    'Local-first — all data stays on your machine',
    'No account, login, or cloud sync required',
    'HTTP, gRPC, WebSocket, GraphQL support',
    'Pre/post-request scripting (QuickJS sandbox)',
    'Collection runner and automated tests',
    'Environment variables with secret masking',
    'Import/export: Postman, Insomnia, OpenAPI',
    'Built-in Git integration',
    'CLI runner for CI/CD pipelines',
    'OpenAPI spec sync and mock server'
  ];

  const CheckIcon = () => (
    <svg
      className="flex-shrink-0 w-5 h-5 text-green-500"
      fill="currentColor"
      viewBox="0 0 20 20"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        fillRule="evenodd"
        d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
        clipRule="evenodd"
      />
    </svg>
  );

  return (
    <StyledWrapper>
      <Modal size="sm" title="Hey API" handleCancel={onClose} hideFooter={true}>
        <div className="flex flex-col w-full">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-medium">Open Source &amp; Free — Always</h3>
            <a
              href="https://github.com/sakettt25/Hey-api"
              target="_blank"
              rel="noopener noreferrer"
              className="flex text-white bg-indigo-600 hover:bg-indigo-700 font-medium rounded-lg px-4 py-2 text-center cursor-pointer text-sm"
            >
              ★ Star on GitHub
            </a>
          </div>

          <p className="text-sm mb-4 opacity-75">
            Hey API is community-driven. Every feature listed here is free, open-source,
            and runs entirely on your device.
          </p>

          <ul role="list" className="space-y-2 text-left mb-6">
            {features.map((item, index) => (
              <li className="flex items-center space-x-3" key={index}>
                <CheckIcon />
                <span className="text-sm">{item}</span>
              </li>
            ))}
          </ul>

          <div className="border-t pt-4 text-xs opacity-50">
            Built upon Bruno (MIT) — Copyright © 2022 Anoop M D, Anusree P S and Contributors
          </div>
        </div>
      </Modal>
    </StyledWrapper>
  );
};

export default CommunityInfo;
