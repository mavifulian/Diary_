import { ConnectButton } from '@rainbow-me/rainbowkit';
import '@rainbow-me/rainbowkit/styles.css';
import React, { useEffect, useState } from "react";
import { getContractReadOnly, getContractWithSigner } from "./components/useContract";
import "./App.css";
import { useAccount } from 'wagmi';
import { useFhevm, useEncrypt, useDecrypt } from '../fhevm-sdk/src';
import { ethers } from 'ethers';

interface DiaryEntry {
  id: number;
  title: string;
  content: string;
  mood: number;
  date: number;
  creator: string;
  publicValue1: number;
  publicValue2: number;
  isVerified?: boolean;
  decryptedValue?: number;
}

interface DiaryStats {
  totalEntries: number;
  verifiedEntries: number;
  avgMood: number;
  recentEntries: number;
}

const App: React.FC = () => {
  const { address, isConnected } = useAccount();
  const [loading, setLoading] = useState(true);
  const [diaries, setDiaries] = useState<DiaryEntry[]>([]);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [creatingDiary, setCreatingDiary] = useState(false);
  const [transactionStatus, setTransactionStatus] = useState<{ visible: boolean; status: "pending" | "success" | "error"; message: string; }>({ 
    visible: false, 
    status: "pending", 
    message: "" 
  });
  const [newDiaryData, setNewDiaryData] = useState({ title: "", content: "", mood: "" });
  const [selectedDiary, setSelectedDiary] = useState<DiaryEntry | null>(null);
  const [decryptedData, setDecryptedData] = useState<number | null>(null);
  const [isDecrypting, setIsDecrypting] = useState(false);
  const [contractAddress, setContractAddress] = useState("");
  const [fhevmInitializing, setFhevmInitializing] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [stats, setStats] = useState<DiaryStats>({ totalEntries: 0, verifiedEntries: 0, avgMood: 0, recentEntries: 0 });

  const { status, initialize, isInitialized } = useFhevm();
  const { encrypt, isEncrypting } = useEncrypt();
  const { verifyDecryption, isDecrypting: fheIsDecrypting } = useDecrypt();

  useEffect(() => {
    const initFhevmAfterConnection = async () => {
      if (!isConnected || isInitialized || fhevmInitializing) return;
      
      try {
        setFhevmInitializing(true);
        console.log('Initializing FHEVM for private diary...');
        await initialize();
        console.log('FHEVM initialized successfully');
      } catch (error) {
        console.error('Failed to initialize FHEVM:', error);
        setTransactionStatus({ 
          visible: true, 
          status: "error", 
          message: "FHEVM initialization failed" 
        });
        setTimeout(() => setTransactionStatus({ visible: false, status: "pending", message: "" }), 3000);
      } finally {
        setFhevmInitializing(false);
      }
    };

    initFhevmAfterConnection();
  }, [isConnected, isInitialized, initialize, fhevmInitializing]);

  useEffect(() => {
    const loadDataAndContract = async () => {
      if (!isConnected) {
        setLoading(false);
        return;
      }
      
      try {
        await loadData();
        const contract = await getContractReadOnly();
        if (contract) setContractAddress(await contract.getAddress());
      } catch (error) {
        console.error('Failed to load data:', error);
      } finally {
        setLoading(false);
      }
    };

    loadDataAndContract();
  }, [isConnected]);

  const loadData = async () => {
    if (!isConnected) return;
    
    setIsRefreshing(true);
    try {
      const contract = await getContractReadOnly();
      if (!contract) return;
      
      const businessIds = await contract.getAllBusinessIds();
      const diariesList: DiaryEntry[] = [];
      
      for (const businessId of businessIds) {
        try {
          const businessData = await contract.getBusinessData(businessId);
          diariesList.push({
            id: parseInt(businessId.replace('diary-', '')) || Date.now(),
            title: businessData.name,
            content: businessData.description,
            mood: Number(businessData.publicValue1) || 0,
            date: Number(businessData.timestamp),
            creator: businessData.creator,
            publicValue1: Number(businessData.publicValue1) || 0,
            publicValue2: Number(businessData.publicValue2) || 0,
            isVerified: businessData.isVerified,
            decryptedValue: Number(businessData.decryptedValue) || 0
          });
        } catch (e) {
          console.error('Error loading diary data:', e);
        }
      }
      
      setDiaries(diariesList);
      updateStats(diariesList);
    } catch (e) {
      setTransactionStatus({ visible: true, status: "error", message: "Failed to load diaries" });
      setTimeout(() => setTransactionStatus({ visible: false, status: "pending", message: "" }), 3000);
    } finally { 
      setIsRefreshing(false); 
    }
  };

  const updateStats = (diaryList: DiaryEntry[]) => {
    const totalEntries = diaryList.length;
    const verifiedEntries = diaryList.filter(d => d.isVerified).length;
    const avgMood = totalEntries > 0 ? diaryList.reduce((sum, d) => sum + d.mood, 0) / totalEntries : 0;
    const recentEntries = diaryList.filter(d => Date.now()/1000 - d.date < 60 * 60 * 24 * 7).length;
    
    setStats({ totalEntries, verifiedEntries, avgMood, recentEntries });
  };

  const createDiary = async () => {
    if (!isConnected || !address) { 
      setTransactionStatus({ visible: true, status: "error", message: "Please connect wallet first" });
      setTimeout(() => setTransactionStatus({ visible: false, status: "pending", message: "" }), 3000);
      return; 
    }
    
    setCreatingDiary(true);
    setTransactionStatus({ visible: true, status: "pending", message: "Creating encrypted diary entry..." });
    
    try {
      const contract = await getContractWithSigner();
      if (!contract) throw new Error("Failed to get contract with signer");
      
      const moodValue = parseInt(newDiaryData.mood) || 0;
      const businessId = `diary-${Date.now()}`;
      
      const encryptedResult = await encrypt(contractAddress, address, moodValue);
      
      const tx = await contract.createBusinessData(
        businessId,
        newDiaryData.title,
        encryptedResult.encryptedData,
        encryptedResult.proof,
        moodValue,
        0,
        newDiaryData.content
      );
      
      setTransactionStatus({ visible: true, status: "pending", message: "Waiting for transaction confirmation..." });
      await tx.wait();
      
      setTransactionStatus({ visible: true, status: "success", message: "Diary created successfully!" });
      setTimeout(() => {
        setTransactionStatus({ visible: false, status: "pending", message: "" });
      }, 2000);
      
      await loadData();
      setShowCreateModal(false);
      setNewDiaryData({ title: "", content: "", mood: "" });
    } catch (e: any) {
      const errorMessage = e.message?.includes("user rejected transaction") 
        ? "Transaction rejected" 
        : "Creation failed: " + (e.message || "Unknown error");
      setTransactionStatus({ visible: true, status: "error", message: errorMessage });
      setTimeout(() => setTransactionStatus({ visible: false, status: "pending", message: "" }), 3000);
    } finally { 
      setCreatingDiary(false); 
    }
  };

  const decryptData = async (businessId: string): Promise<number | null> => {
    if (!isConnected || !address) { 
      setTransactionStatus({ visible: true, status: "error", message: "Please connect wallet first" });
      setTimeout(() => setTransactionStatus({ visible: false, status: "pending", message: "" }), 3000);
      return null; 
    }
    
    setIsDecrypting(true);
    try {
      const contractRead = await getContractReadOnly();
      if (!contractRead) return null;
      
      const businessData = await contractRead.getBusinessData(businessId);
      if (businessData.isVerified) {
        const storedValue = Number(businessData.decryptedValue) || 0;
        setTransactionStatus({ visible: true, status: "success", message: "Data already verified" });
        setTimeout(() => setTransactionStatus({ visible: false, status: "pending", message: "" }), 2000);
        return storedValue;
      }
      
      const contractWrite = await getContractWithSigner();
      if (!contractWrite) return null;
      
      const encryptedValueHandle = await contractRead.getEncryptedValue(businessId);
      
      const result = await verifyDecryption(
        [encryptedValueHandle],
        contractAddress,
        (abiEncodedClearValues: string, decryptionProof: string) => 
          contractWrite.verifyDecryption(businessId, abiEncodedClearValues, decryptionProof)
      );
      
      setTransactionStatus({ visible: true, status: "pending", message: "Verifying decryption..." });
      
      const clearValue = result.decryptionResult.clearValues[encryptedValueHandle];
      await loadData();
      
      setTransactionStatus({ visible: true, status: "success", message: "Data verified successfully!" });
      setTimeout(() => setTransactionStatus({ visible: false, status: "pending", message: "" }), 2000);
      
      return Number(clearValue);
      
    } catch (e: any) { 
      if (e.message?.includes("Data already verified")) {
        setTransactionStatus({ visible: true, status: "success", message: "Data is already verified" });
        setTimeout(() => setTransactionStatus({ visible: false, status: "pending", message: "" }), 2000);
        await loadData();
        return null;
      }
      
      setTransactionStatus({ visible: true, status: "error", message: "Decryption failed" });
      setTimeout(() => setTransactionStatus({ visible: false, status: "pending", message: "" }), 3000);
      return null; 
    } finally { 
      setIsDecrypting(false); 
    }
  };

  const filteredDiaries = diaries.filter(diary => 
    diary.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
    diary.content.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const renderStats = () => {
    return (
      <div className="stats-grid">
        <div className="stat-card pink">
          <h3>Total Entries</h3>
          <div className="stat-value">{stats.totalEntries}</div>
          <div className="stat-trend">+{stats.recentEntries} this week</div>
        </div>
        
        <div className="stat-card purple">
          <h3>Verified Entries</h3>
          <div className="stat-value">{stats.verifiedEntries}/{stats.totalEntries}</div>
          <div className="stat-trend">FHE Protected</div>
        </div>
        
        <div className="stat-card blue">
          <h3>Avg Mood</h3>
          <div className="stat-value">{stats.avgMood.toFixed(1)}/10</div>
          <div className="stat-trend">Encrypted</div>
        </div>
      </div>
    );
  };

  const renderFHEInfo = () => {
    return (
      <div className="fhe-info-panel">
        <h3>🔐 FHE Encryption流程</h3>
        <div className="fhe-flow">
          <div className="flow-step">
            <div className="step-icon">1</div>
            <div className="step-content">
              <h4>心情加密</h4>
              <p>使用Zama FHE加密心情数值</p>
            </div>
          </div>
          <div className="flow-arrow">→</div>
          <div className="flow-step">
            <div className="step-icon">2</div>
            <div className="step-content">
              <h4>链上存储</h4>
              <p>加密数据安全存储于区块链</p>
            </div>
          </div>
          <div className="flow-arrow">→</div>
          <div className="flow-step">
            <div className="step-icon">3</div>
            <div className="step-content">
              <h4>离线解密</h4>
              <p>客户端离线解密验证</p>
            </div>
          </div>
          <div className="flow-arrow">→</div>
          <div className="flow-step">
            <div className="step-icon">4</div>
            <div className="step-content">
              <h4>链上验证</h4>
              <p>提交证明进行FHE签名验证</p>
            </div>
          </div>
        </div>
      </div>
    );
  };

  if (!isConnected) {
    return (
      <div className="app-container">
        <header className="app-header">
          <div className="logo">
            <h1>🌸 私人日记本</h1>
          </div>
          <div className="header-actions">
            <ConnectButton accountStatus="address" chainStatus="icon" showBalance={false}/>
          </div>
        </header>
        
        <div className="connection-prompt">
          <div className="connection-content">
            <div className="connection-icon">🔐</div>
            <h2>连接钱包开始使用</h2>
            <p>请连接您的钱包来初始化加密日记系统</p>
            <div className="connection-steps">
              <div className="step">
                <span>1</span>
                <p>点击上方按钮连接钱包</p>
              </div>
              <div className="step">
                <span>2</span>
                <p>FHE系统将自动初始化</p>
              </div>
              <div className="step">
                <span>3</span>
                <p>开始记录加密日记</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!isInitialized || fhevmInitializing) {
    return (
      <div className="loading-screen">
        <div className="fhe-spinner"></div>
        <p>初始化FHE加密系统...</p>
        <p>状态: {fhevmInitializing ? "初始化FHEVM" : status}</p>
      </div>
    );
  }

  if (loading) return (
    <div className="loading-screen">
      <div className="fhe-spinner"></div>
      <p>加载加密日记系统...</p>
    </div>
  );

  return (
    <div className="app-container">
      <header className="app-header">
        <div className="logo">
          <h1>🌸 私人日记本</h1>
        </div>
        
        <div className="header-actions">
          <button 
            onClick={() => setShowCreateModal(true)} 
            className="create-btn"
          >
            + 新日记
          </button>
          <ConnectButton accountStatus="address" chainStatus="icon" showBalance={false}/>
        </div>
      </header>
      
      <div className="main-content">
        <div className="dashboard-section">
          <h2>我的加密日记本 🔐</h2>
          {renderStats()}
          {renderFHEInfo()}
        </div>
        
        <div className="diaries-section">
          <div className="section-header">
            <h2>日记列表</h2>
            <div className="header-actions">
              <input 
                type="text" 
                placeholder="搜索日记..." 
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="search-input"
              />
              <button 
                onClick={loadData} 
                className="refresh-btn" 
                disabled={isRefreshing}
              >
                {isRefreshing ? "刷新中..." : "刷新"}
              </button>
            </div>
          </div>
          
          <div className="diaries-list">
            {filteredDiaries.length === 0 ? (
              <div className="no-diaries">
                <p>暂无日记记录</p>
                <button 
                  className="create-btn" 
                  onClick={() => setShowCreateModal(true)}
                >
                  写第一篇日记
                </button>
              </div>
            ) : filteredDiaries.map((diary, index) => (
              <div 
                className={`diary-item ${selectedDiary?.id === diary.id ? "selected" : ""} ${diary.isVerified ? "verified" : ""}`} 
                key={index}
                onClick={() => setSelectedDiary(diary)}
              >
                <div className="diary-title">{diary.title}</div>
                <div className="diary-content">{diary.content.substring(0, 100)}...</div>
                <div className="diary-meta">
                  <span>心情: {diary.mood}/10</span>
                  <span>日期: {new Date(diary.date * 1000).toLocaleDateString()}</span>
                </div>
                <div className="diary-status">
                  {diary.isVerified ? "✅ 已验证" : "🔓 待验证"}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
      
      {showCreateModal && (
        <ModalCreateDiary 
          onSubmit={createDiary} 
          onClose={() => setShowCreateModal(false)} 
          creating={creatingDiary} 
          diaryData={newDiaryData} 
          setDiaryData={setNewDiaryData}
          isEncrypting={isEncrypting}
        />
      )}
      
      {selectedDiary && (
        <DiaryDetailModal 
          diary={selectedDiary} 
          onClose={() => { 
            setSelectedDiary(null); 
            setDecryptedData(null); 
          }} 
          decryptedData={decryptedData} 
          setDecryptedData={setDecryptedData} 
          isDecrypting={isDecrypting || fheIsDecrypting} 
          decryptData={() => decryptData(`diary-${selectedDiary.id}`)}
        />
      )}
      
      {transactionStatus.visible && (
        <div className="transaction-modal">
          <div className="transaction-content">
            <div className={`transaction-icon ${transactionStatus.status}`}>
              {transactionStatus.status === "pending" && <div className="fhe-spinner"></div>}
              {transactionStatus.status === "success" && <div className="success-icon">✓</div>}
              {transactionStatus.status === "error" && <div className="error-icon">✗</div>}
            </div>
            <div className="transaction-message">{transactionStatus.message}</div>
          </div>
        </div>
      )}
    </div>
  );
};

const ModalCreateDiary: React.FC<{
  onSubmit: () => void; 
  onClose: () => void; 
  creating: boolean;
  diaryData: any;
  setDiaryData: (data: any) => void;
  isEncrypting: boolean;
}> = ({ onSubmit, onClose, creating, diaryData, setDiaryData, isEncrypting }) => {
  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    if (name === 'mood') {
      const intValue = value.replace(/[^\d]/g, '');
      setDiaryData({ ...diaryData, [name]: intValue });
    } else {
      setDiaryData({ ...diaryData, [name]: value });
    }
  };

  return (
    <div className="modal-overlay">
      <div className="create-diary-modal">
        <div className="modal-header">
          <h2>写新日记</h2>
          <button onClick={onClose} className="close-modal">&times;</button>
        </div>
        
        <div className="modal-body">
          <div className="fhe-notice">
            <strong>FHE 🔐 加密保护</strong>
            <p>心情数值将使用Zama FHE进行加密（仅支持整数）</p>
          </div>
          
          <div className="form-group">
            <label>日记标题 *</label>
            <input 
              type="text" 
              name="title" 
              value={diaryData.title} 
              onChange={handleChange} 
              placeholder="输入日记标题..." 
            />
          </div>
          
          <div className="form-group">
            <label>日记内容 *</label>
            <textarea 
              name="content" 
              value={diaryData.content} 
              onChange={handleChange} 
              placeholder="写下今天的感受..." 
              rows={4}
            />
          </div>
          
          <div className="form-group">
            <label>心情指数 (1-10) *</label>
            <input 
              type="number" 
              min="1" 
              max="10" 
              name="mood" 
              value={diaryData.mood} 
              onChange={handleChange} 
              placeholder="输入心情指数..." 
            />
            <div className="data-type-label">FHE加密整数</div>
          </div>
        </div>
        
        <div className="modal-footer">
          <button onClick={onClose} className="cancel-btn">取消</button>
          <button 
            onClick={onSubmit} 
            disabled={creating || isEncrypting || !diaryData.title || !diaryData.content || !diaryData.mood} 
            className="submit-btn"
          >
            {creating || isEncrypting ? "加密并创建中..." : "创建日记"}
          </button>
        </div>
      </div>
    </div>
  );
};

const DiaryDetailModal: React.FC<{
  diary: DiaryEntry;
  onClose: () => void;
  decryptedData: number | null;
  setDecryptedData: (value: number | null) => void;
  isDecrypting: boolean;
  decryptData: () => Promise<number | null>;
}> = ({ diary, onClose, decryptedData, setDecryptedData, isDecrypting, decryptData }) => {
  const handleDecrypt = async () => {
    if (decryptedData !== null) { 
      setDecryptedData(null); 
      return; 
    }
    
    const decrypted = await decryptData();
    if (decrypted !== null) {
      setDecryptedData(decrypted);
    }
  };

  return (
    <div className="modal-overlay">
      <div className="diary-detail-modal">
        <div className="modal-header">
          <h2>日记详情</h2>
          <button onClick={onClose} className="close-modal">&times;</button>
        </div>
        
        <div className="modal-body">
          <div className="diary-info">
            <div className="info-item">
              <span>标题:</span>
              <strong>{diary.title}</strong>
            </div>
            <div className="info-item">
              <span>日期:</span>
              <strong>{new Date(diary.date * 1000).toLocaleDateString()}</strong>
            </div>
            <div className="info-item">
              <span>公开心情指数:</span>
              <strong>{diary.mood}/10</strong>
            </div>
          </div>
          
          <div className="content-section">
            <h3>日记内容</h3>
            <div className="diary-content-full">{diary.content}</div>
          </div>
          
          <div className="data-section">
            <h3>加密心情数据</h3>
            
            <div className="data-row">
              <div className="data-label">加密心情值:</div>
              <div className="data-value">
                {diary.isVerified && diary.decryptedValue ? 
                  `${diary.decryptedValue} (链上已验证)` : 
                  decryptedData !== null ? 
                  `${decryptedData} (本地解密)` : 
                  "🔒 FHE加密整数"
                }
              </div>
              <button 
                className={`decrypt-btn ${(diary.isVerified || decryptedData !== null) ? 'decrypted' : ''}`}
                onClick={handleDecrypt} 
                disabled={isDecrypting}
              >
                {isDecrypting ? "🔓 验证中..." : diary.isVerified ? "✅ 已验证" : decryptedData !== null ? "🔄 重新验证" : "🔓 验证解密"}
              </button>
            </div>
            
            <div className="fhe-info">
              <div className="fhe-icon">🔐</div>
              <div>
                <strong>FHE 🔐 自中继解密</strong>
                <p>数据在链上加密存储。点击"验证解密"进行离线解密和链上验证。</p>
              </div>
            </div>
          </div>
        </div>
        
        <div className="modal-footer">
          <button onClick={onClose} className="close-btn">关闭</button>
          {!diary.isVerified && (
            <button 
              onClick={handleDecrypt} 
              disabled={isDecrypting}
              className="verify-btn"
            >
              {isDecrypting ? "链上验证中..." : "链上验证"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default App;