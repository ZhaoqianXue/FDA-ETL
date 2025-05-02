import React, { useState } from 'react';
import './EventTable.css';

const EventTable = ({ events, loading, totalEvents, currentPage, pageSize, onPageChange }) => {
  // Format date from YYYYMMDD to YYYY-MM-DD for display
  const formatDate = (dateStr) => {
    if (!dateStr || dateStr.length !== 8) return 'Unknown';
    return `${dateStr.substring(0, 4)}-${dateStr.substring(4, 6)}-${dateStr.substring(6, 8)}`;
  };

  // Get severity text based on serious flag
  const getSeverityText = (serious) => {
    return serious === 1 ? 'Serious' : 'Non-serious';
  };

  // Get patient gender text
  const getGenderText = (genderCode) => {
    switch (genderCode) {
      case 1: return 'Male';
      case 2: return 'Female';
      default: return 'Unknown';
    }
  };

  // Calculate total number of pages
  const totalPages = Math.ceil(totalEvents / pageSize);

  // 跳转页输入框状态
  const [inputPage, setInputPage] = useState("");

  // Generate array of page numbers to display
  const getPageNumbers = () => {
    const maxPagesToShow = 5;
    let startPage = Math.max(1, currentPage - Math.floor(maxPagesToShow / 2));
    let endPage = startPage + maxPagesToShow - 1;

    if (endPage > totalPages) {
      endPage = totalPages;
      startPage = Math.max(1, endPage - maxPagesToShow + 1);
    }

    return Array.from({ length: endPage - startPage + 1 }, (_, i) => startPage + i);
  };

  // 药物名标准化显示
  const getDrugName = (name) => {
    if (!name) return '';
    const n = name.toLowerCase();
    if (n === 'semaglutide') return 'Semaglutide';
    if (n === 'tirzepatide') return 'Tirzepatide';
    return name.charAt(0).toUpperCase() + name.slice(1).toLowerCase();
  };

  // 剂量单位代码映射
  const dosageUnitMap = {
    '001': 'mg',
    '002': 'g',
    '003': 'ml',
    '004': 'units',
    '005': 'ug',
    '006': 'ng',
    '007': 'meq',
    '008': 'mmol',
    '009': '%',
    '010': 'IU'
  };
  const getDosage = (num, unit) => {
    if (!num) return 'Unknown';
    if (unit && dosageUnitMap[unit]) return `${num} ${dosageUnitMap[unit]}`;
    if (unit) return `${num} ${unit}`;
    return num;
  };

  const formatRoute = (route) => {
    if (!route) return 'Unknown';
    return route.charAt(0).toUpperCase() + route.slice(1).toLowerCase();
  };

  return (
    <div className="event-table-container">
      {loading ? (
        <div className="loading-indicator">Loading data...</div>
      ) : events.length === 0 ? (
        <div className="no-data-message">No adverse events found. Try adjusting your filters.</div>
      ) : (
        <>
          <div className="table-responsive">
            <table className="event-table">
              <thead>
                <tr>
                  <th className="numeric">Report ID</th>
                  <th>Report Date</th>
                  <th>Event Country</th>
                  <th>Medication</th>
                  <th>Adverse Event</th>
                  <th>Severity</th>
                  <th>Gender</th>
                  <th className="numeric">Age</th>
                  <th className="numeric">Weight (kg)</th>
                  <th>Route</th>
                  <th>Start Date</th>
                  <th>End Date</th>
                  <th className="numeric">Dosage</th>
                </tr>
              </thead>
              <tbody>
                {events.map((event) => (
                  <tr key={`${event.top_safetyreportid}-${event.reaction_reactionmeddrapt}`}>
                    <td className="numeric">{event.top_safetyreportid}</td>
                    <td>{formatDate(event.top_receivedate)}</td>
                    <td>{event.top_occurcountry || 'Unknown'}</td>
                    <td>{getDrugName(event.drug_medicinalproduct)}</td>
                    <td>{event.reaction_reactionmeddrapt}</td>
                    <td>{getSeverityText(event.top_serious)}</td>
                    <td>{getGenderText(event.patient_patientsex)}</td>
                    <td className="numeric">
                      {event.patient_patientonsetage != null
                        ? parseInt(event.patient_patientonsetage, 10)
                        : 'Unknown'}
                    </td>
                    <td className="numeric">{event.patient_patientweight != null ? event.patient_patientweight : 'Unknown'}</td>
                    <td>{formatRoute(event.drug_openfda_route)}</td>
                    <td>{formatDate(event.drug_drugstartdate) || 'Unknown'}</td>
                    <td>{formatDate(event.drug_drugenddate) || 'Unknown'}</td>
                    <td className="numeric">{getDosage(event.drug_drugstructuredosagenumb, event.drug_drugstructuredosageunit)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="pagination">
            <div className="pagination-info">
              Showing {(currentPage - 1) * pageSize + 1} to {Math.min(currentPage * pageSize, totalEvents)} of {totalEvents} records
            </div>
            
            <div className="pagination-controls">
              <button
                type="button"
                className="pagination-button"
                disabled={currentPage === 1}
                onClick={() => onPageChange(1)}
              >
                First
              </button>
              <button
                type="button"
                className="pagination-button"
                disabled={currentPage === 1}
                onClick={() => onPageChange(currentPage - 1)}
              >
                Previous
              </button>
              {getPageNumbers().map(number => (
                <button
                  type="button"
                  key={number}
                  className={`pagination-button ${currentPage === number ? 'active' : ''}`}
                  onClick={() => onPageChange(number)}
                >
                  {number}
                </button>
              ))}
              <button
                type="button"
                className="pagination-button"
                disabled={currentPage === totalPages}
                onClick={() => onPageChange(currentPage + 1)}
              >
                Next
              </button>
              <button
                type="button"
                className="pagination-button"
                disabled={currentPage === totalPages}
                onClick={() => onPageChange(totalPages)}
              >
                Last
              </button>
              <div className="pagination-goto">
                <span className="pagination-goto-label">Go to</span>
                <input
                  type="text"
                  min={1}
                  max={totalPages}
                  value={inputPage}
                  onChange={e => setInputPage(e.target.value.replace(/[^\d]/g, ''))}
                  onKeyDown={e => {
                    if (e.key === 'Enter') {
                      const page = Math.max(1, Math.min(totalPages, Number(inputPage)));
                      if (page && page !== currentPage) onPageChange(page);
                      setInputPage("");
                    }
                  }}
                  onBlur={() => {
                    if (inputPage) {
                      const page = Math.max(1, Math.min(totalPages, Number(inputPage)));
                      if (page && page !== currentPage) onPageChange(page);
                      setInputPage("");
                    }
                  }}
                  className="pagination-input"
                  placeholder="#"
                />
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default EventTable; 