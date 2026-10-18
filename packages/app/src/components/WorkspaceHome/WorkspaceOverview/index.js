import React, { useState } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { IconPlus, IconFolder, IconDownload } from '@tabler/icons';
import { importCollection, importCollectionFromZip } from 'providers/ReduxStore/slices/collections/actions';
import { setIsCreatingCollection, setIsOpeningCollection, toggleSidebarCollapse } from 'providers/ReduxStore/slices/app';
import { setLocalStorageValue, SIDEBAR_COLLAPSED_KEY } from 'utils/common/localStorage';
import toast from 'react-hot-toast';
import ImportCollection from 'components/Sidebar/ImportCollection';
import ImportCollectionLocation from 'components/Sidebar/ImportCollectionLocation';
import BulkImportCollectionLocation from 'components/Sidebar/BulkImportCollectionLocation';
import CloneGitRepository from 'components/Sidebar/CloneGitRespository';
import PostmanPackageReport from 'components/Sidebar/PostmanPackageReport';
import usePostmanPackagePrompt from 'hooks/usePostmanPackagePrompt';
import CollectionsList from './CollectionsList';
import WorkspaceDocs from '../WorkspaceDocs';
import StyledWrapper from './StyledWrapper';

// Mini sparkline bars – heights vary to form a bar chart shape
const SPARKLINE_HEIGHTS = [30, 45, 25, 60, 40, 55, 35, 70, 50, 65, 45, 80, 55, 90, 60];

const SparklineChart = () => (
  <div className="stat-sparkline">
    {SPARKLINE_HEIGHTS.map((h, i) => (
      <div
        key={i}
        className="sparkline-bar"
        style={{ height: `${h}%` }}
      />
    ))}
  </div>
);

const WorkspaceOverview = ({ workspace }) => {
  const dispatch = useDispatch();
  const { globalEnvironments } = useSelector((state) => state.globalEnvironments);
  const { sidebarCollapsed, isCreatingCollection } = useSelector((state) => state.app);

  const [importCollectionModalOpen, setImportCollectionModalOpen] = useState(false);
  const [importCollectionLocationModalOpen, setImportCollectionLocationModalOpen] = useState(false);
  const [importData, setImportData] = useState(null);
  const [showCloneGitModal, setShowCloneGitModal] = useState(false);
  const [gitRepositoryUrl, setGitRepositoryUrl] = useState(null);
  const { postmanPackagePrompt, clearPostmanPackagePrompt, handleImportResolved } = usePostmanPackagePrompt();

  const workspaceCollectionsCount = workspace?.collections?.length || 0;
  const workspaceEnvironmentsCount = globalEnvironments?.length || 0;

  const handleCreateCollection = async () => {
    if (isCreatingCollection) return;
    if (!workspace?.pathname) {
      toast.error('Workspace path not found');
      return;
    }
    try {
      const { ipcRenderer } = window;
      await ipcRenderer.invoke('renderer:ensure-collections-folder', workspace.pathname);
      if (sidebarCollapsed) {
        dispatch(toggleSidebarCollapse());
        setLocalStorageValue(SIDEBAR_COLLAPSED_KEY, false);
      }
      dispatch(setIsCreatingCollection(true));
    } catch (error) {
      console.error('Error ensuring collections folder exists:', error);
      toast.error('Error preparing workspace for collection creation');
    }
  };

  const handleOpenCollection = () => {
    dispatch(setIsOpeningCollection(true));
  };

  const handleImportCollection = () => {
    setImportCollectionModalOpen(true);
  };

  const handleImportCollectionSubmit = ({ rawData, type, repositoryUrl, ...rest }) => {
    setImportCollectionModalOpen(false);

    if (type === 'git-repository') {
      setGitRepositoryUrl(repositoryUrl);
      setShowCloneGitModal(true);
      return;
    }

    setImportData({ rawData, type, ...rest });
    setImportCollectionLocationModalOpen(true);
  };

  const handleImportCollectionLocation = (convertedCollection, collectionLocation, options = {}) => {
    const importAction = options.isZipImport
      ? importCollectionFromZip(convertedCollection.zipFilePath, collectionLocation)
      : importCollection(convertedCollection, collectionLocation, options);

    dispatch(importAction)
      .then((importedItem) => {
        setImportCollectionLocationModalOpen(false);
        setImportData(null);
        handleImportResolved(convertedCollection, importedItem);
      });
  };

  const handleCloseGitModal = () => {
    setShowCloneGitModal(false);
    setGitRepositoryUrl(null);
  };

  return (
    <StyledWrapper>
      {importCollectionModalOpen && (
        <ImportCollection
          onClose={() => setImportCollectionModalOpen(false)}
          handleSubmit={handleImportCollectionSubmit}
        />
      )}

      {importCollectionLocationModalOpen && importData && (importData.type !== 'multiple' && importData.type !== 'bulk') && (
        <ImportCollectionLocation
          rawData={importData.rawData}
          format={importData.type}
          sourceUrl={importData.sourceUrl}
          filePath={importData.filePath}
          rawContent={importData.rawContent}
          onClose={() => setImportCollectionLocationModalOpen(false)}
          handleSubmit={handleImportCollectionLocation}
        />
      )}
      {importCollectionLocationModalOpen && importData && (importData.type === 'multiple' || importData.type === 'bulk') && (
        <BulkImportCollectionLocation
          importData={importData}
          onClose={() => setImportCollectionLocationModalOpen(false)}
          handleSubmit={handleImportCollectionLocation}
        />
      )}
      {showCloneGitModal && (
        <CloneGitRepository
          onClose={handleCloseGitModal}
          onFinish={handleCloseGitModal}
          collectionRepositoryUrl={gitRepositoryUrl}
        />
      )}
      {postmanPackagePrompt && (
        <PostmanPackageReport
          key={postmanPackagePrompt.collectionPath}
          report={postmanPackagePrompt.report}
          collectionPath={postmanPackagePrompt.collectionPath}
          onClose={clearPostmanPackagePrompt}
        />
      )}

      <div className="overview-layout">
        <div className="overview-main">
          <div className="overview-heading">Workspace Overview</div>

          {/* ── Stat cards ── */}
          <div className="stats-row">
            <div className="stat-card">
              <span className="stat-label">Collections</span>
              <div className="stat-value-row">
                <span className="stat-value">{workspaceCollectionsCount}</span>
                <SparklineChart />
              </div>
            </div>

            <div className="stat-card">
              <span className="stat-label">Environments</span>
              <div className="stat-value-row">
                <span className="stat-value">{workspaceEnvironmentsCount}</span>
                <SparklineChart />
              </div>
            </div>
          </div>

          {/* ── Quick Actions ── */}
          <div className="quick-actions-section">
            <div className="section-title">Quick Actions</div>
            <div className="quick-actions-buttons">
              <button className="quick-action-card" onClick={handleCreateCollection} disabled={isCreatingCollection}>
                <div className="quick-action-icon">
                  <IconPlus size={16} strokeWidth={1.5} />
                </div>
                <span className="quick-action-label">[Create Collection]</span>
              </button>

              <button className="quick-action-card" onClick={handleOpenCollection}>
                <div className="quick-action-icon">
                  <IconFolder size={16} strokeWidth={1.5} />
                </div>
                <span className="quick-action-label">[Open Collection]</span>
              </button>

              <button className="quick-action-card" onClick={handleImportCollection}>
                <div className="quick-action-icon">
                  <IconDownload size={16} strokeWidth={1.5} />
                </div>
                <span className="quick-action-label">[Import Collection]</span>
              </button>
            </div>
          </div>

          {/* ── Collections list ── */}
          <div className="collections-section">
            <div className="section-title">Collections</div>
            <CollectionsList workspace={workspace} />
          </div>
        </div>

        <div className="overview-docs">
          <WorkspaceDocs key={workspace?.uid} workspace={workspace} />
        </div>
      </div>
    </StyledWrapper>
  );
};

export default WorkspaceOverview;
