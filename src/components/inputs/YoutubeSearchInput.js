import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { FiClock, FiSearch, FiX } from 'react-icons/fi';
import { searchYouTubeVideos, isOAuthEnabled, hasValidTokens } from '../../services/youtubeApiService';
import { addSearchQueryToHistory, getSearchQueryHistory, clearSearchQueryHistory, formatTimestamp } from '../../utils/historyUtils';
import QualitySelector from './QualitySelector';

const YoutubeSearchInput = ({ apiKeysSet = { youtube: false }, selectedVideo, setSelectedVideo, className }) => {
  const { t } = useTranslation();
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const [error, setError] = useState('');
  const [showHistory, setShowHistory] = useState(false);
  const [history, setHistory] = useState([]);
  const historyDropdownRef = useRef(null);
  const inputRef = useRef(null);

  // Debounce function for search
  const useDebounce = (value, delay) => {
    const [debouncedValue, setDebouncedValue] = useState(value);

    useEffect(() => {
      const handler = setTimeout(() => {
        setDebouncedValue(value);
      }, delay);

      return () => {
        clearTimeout(handler);
      };
    }, [value, delay]);

    return debouncedValue;
  };



  // Search YouTube API - using useCallback to allow it in the dependency array
  const searchYouTube = useCallback(async (query) => {
    setIsSearching(true);
    setError('');

    try {
      let results = [];

      // Use the YouTube API service
      results = await searchYouTubeVideos(query);

      if (results.length > 0) {
        setSearchResults(results);
      } else {
        setSearchResults([]);
        setError(t('youtube.noResults', 'No results found.'));
      }
    } catch (error) {
      console.error('Error searching YouTube:', error);

      // Provide more specific error messages
      if (isOAuthEnabled()) {
        // Only show OAuth-specific errors if OAuth is enabled
        if (error.message.includes('OAuth') || error.message.includes('Not authenticated')) {
          setError(t('youtube.authError', 'YouTube authentication required. Please set up OAuth in settings.'));
        } else if (error.message.includes('quota exceeded')) {
          setError(t('errors.quotaExceeded', 'Quota exceeded, please wait tomorrow, or create a new Google Cloud project and update API or OAuth.'));
        } else {
          setError(t('youtube.searchError', 'Error searching YouTube. Please try again or enter a URL directly.'));
        }
      } else {
        // API key method is selected
        if (error.message.includes('API key not found') || error.message.includes('API key')) {
          setError(t('youtube.noApiKey', 'Please set your YouTube API key in the settings first.'));
        } else if (error.message.includes('quota exceeded')) {
          setError(t('errors.quotaExceeded', 'Quota exceeded, please wait tomorrow, or create a new Google Cloud project and update API or OAuth.'));
        } else {
          setError(t('youtube.searchError', 'Error searching YouTube. Please try again or enter a URL directly.'));
        }
      }
    } finally {
      setIsSearching(false);
    }
  }, [t]);

  const debouncedSearchQuery = useDebounce(searchQuery, 500);

  // Load history on component mount
  useEffect(() => {
    setHistory(getSearchQueryHistory());
  }, []);

  // Handle clicks outside the dropdown to close it
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (
        historyDropdownRef.current &&
        !historyDropdownRef.current.contains(event.target) &&
        !event.target.closest('.history-button')
      ) {
        setShowHistory(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  // Search YouTube when query changes
  useEffect(() => {
    if (debouncedSearchQuery.length < 3) {
      setSearchResults([]);
      return;
    }

    // Check authentication method and status
    if (isOAuthEnabled()) {
      if (!hasValidTokens()) {
        setError(t('youtube.noOAuth', 'Please authenticate with YouTube in the settings first.'));
        return;
      }
    } else if (!apiKeysSet.youtube) {
      setError(t('youtube.noApiKey', 'Please set your YouTube API key in the settings first.'));
      return;
    }

    // Add to search history if query is valid
    if (debouncedSearchQuery.trim().length >= 3) {
      addSearchQueryToHistory(debouncedSearchQuery);
      // Refresh history list
      setHistory(getSearchQueryHistory());
    }

    searchYouTube(debouncedSearchQuery);
  }, [debouncedSearchQuery, apiKeysSet.youtube, t, searchYouTube]);

  // Handle search input change
  const handleSearchChange = (e) => {
    setSearchQuery(e.target.value);
  };

  // Handle search result selection
  const handleVideoSelect = (video) => {
    // Clear any existing file URLs when selecting a YouTube video
    localStorage.removeItem('current_file_url');

    // Get the default quality from localStorage
    const quality = localStorage.getItem('youtube_download_quality') || '360p';

    // Add quality to the video object
    setSelectedVideo({
      ...video,
      quality
    });
  };

  // Toggle history dropdown
  const toggleHistory = () => {
    setShowHistory(prev => !prev);
  };

  // Handle selecting a query from history
  const handleSelectFromHistory = (query) => {
    setSearchQuery(query);
    setShowHistory(false);
    // Focus the input field
    if (inputRef.current) {
      inputRef.current.focus();
    }
  };

  // Clear history
  const handleClearHistory = (e) => {
    e.stopPropagation();
    clearSearchQueryHistory();
    setHistory([]);
  };

  return (
    <div className={`youtube-search-input ${className || ''}`}>
      <div className="search-field-container">
        <div className="search-input-wrapper">
          <FiSearch className="search-icon" size={18} />
          <input
            type="text"
            id="youtube-search-input"
            className="youtube-search-field"
            placeholder={t('youtube.searchPlaceholder', 'Enter video title...')}
            value={searchQuery}
            onChange={handleSearchChange}
            ref={inputRef}
          />

          {/* History button */}
          {history.length > 0 && (
            <button
              type="button"
              className="history-button"
              onClick={toggleHistory}
              aria-label={t('common.history', 'History')}
              title={t('common.history', 'History')}
            >
              <FiClock size={18} />
            </button>
          )}

          {searchQuery && (
            <button
              className="clear-search-btn"
              onClick={() => setSearchQuery('')}
              aria-label="Clear search"
            >
              <FiX size={18} />
            </button>
          )}

          {/* History dropdown */}
          {showHistory && history.length > 0 && (
            <div className="history-dropdown" ref={historyDropdownRef}>
              <div className="history-header">
                <h4 className="history-title">{t('youtube.recentSearches', 'Recent Searches')}</h4>
                <button
                  className="clear-history-btn"
                  onClick={handleClearHistory}
                >
                  {t('common.clearAll', 'Clear All')}
                </button>
              </div>
              <div className="history-list">
                {history.map((item, index) => (
                  <div
                    key={`${item.query}-${index}`}
                    className="history-query-item"
                    onClick={() => handleSelectFromHistory(item.query)}
                  >
                    <FiSearch className="history-query-icon" size={16} />
                    <span className="history-query-text">{item.query}</span>
                    <span className="history-query-time">{formatTimestamp(item.timestamp)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="search-results">
        {error && <p className="error">{error}</p>}

        {isSearching && (
          <div className="searching-indicator">
            <div className="search-spinner"></div>
            <p>{t('youtube.searching', 'Searching...')}</p>
          </div>
        )}

        {!isSearching && searchResults.length > 0 && (
          searchResults.map(video => (
            <div
              key={video.id}
              className={`search-result-item ${selectedVideo?.id === video.id ? 'selected' : ''}`}
            >
              <div
                className="search-result-content"
                onClick={() => handleVideoSelect(video)}
              >
                <div className="search-thumbnail-container">
                  <img
                    src={video.thumbnail}
                    alt={video.title}
                    className="search-result-thumbnail"
                  />
                </div>
                <div className="search-result-info">
                  <div className="search-result-title">{video.title}</div>
                  <div className="search-result-channel">{video.channel}</div>
                </div>
              </div>

              {/* Show quality selector for selected video */}
              {selectedVideo?.id === video.id && (
                <QualitySelector
                  onChange={(quality) => {
                    // Update the selected video with the quality
                    setSelectedVideo(prev => ({
                      ...prev,
                      quality
                    }));
                  }}
                />
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default YoutubeSearchInput;