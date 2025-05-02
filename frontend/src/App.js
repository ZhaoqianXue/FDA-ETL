import React, { useState, useEffect } from 'react';
import './App.css';
import Filter from './components/Filter';
import EventTable from './components/EventTable';
import KnowledgeGraph from './components/KnowledgeGraph';
import axios from 'axios';
import Papa from 'papaparse';

function App() {
  const [loading, setLoading] = useState(true);
  const [events, setEvents] = useState([]);
  const [totalEvents, setTotalEvents] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize] = useState(10);
  const [filters, setFilters] = useState({
    medication: '',
    adverse_event: '',
    start_date: '',
    end_date: ''
  });
  const [medications, setMedications] = useState([]);
  const [adverseEvents, setAdverseEvents] = useState([]);
  const [allEvents, setAllEvents] = useState([]);
  const [topPercent, setTopPercent] = useState(5); // Top adverse events percentage

  // Fetch dropdown options when component mounts
  useEffect(() => {
    fetchOptions();
  }, []);

  // Fetch events when filters or pagination changes
  useEffect(() => {
    fetchEvents();
  }, [filters, currentPage]);

  // Fetch all events for knowledge graph when filters change
  useEffect(() => {
    const fetchAllEvents = async () => {
      try {
        const params = { ...filters, page: 1, page_size: 10000 };
        Object.keys(params).forEach(key => {
          if (params[key] === '' || params[key] == null) delete params[key];
        });
        const response = await axios.get('/api/events', { params });
        setAllEvents(response.data.data);
      } catch (error) {
        setAllEvents([]);
      }
    };
    fetchAllEvents();
  }, [filters]);

  const fetchOptions = async () => {
    try {
      const [medicationsRes, adverseEventsRes] = await Promise.all([
        axios.get('/api/medications'),
        axios.get('/api/adverse_events')
      ]);
      // 药物名标准化
      const formatDrugName = (name) => {
        if (!name) return '';
        const n = name.toLowerCase();
        if (n === 'semaglutide') return 'Semaglutide';
        if (n === 'tirzepatide') return 'Tirzepatide';
        return name.charAt(0).toUpperCase() + name.slice(1).toLowerCase();
      };
      setMedications(medicationsRes.data.map(med => ({ value: med, label: formatDrugName(med) })));
      setAdverseEvents(adverseEventsRes.data.map(event => ({ value: event, label: event })));
    } catch (error) {
      console.error('Error fetching options:', error);
    }
  };

  const fetchEvents = async () => {
    setLoading(true);
    try {
      const params = {
        page: currentPage,
        page_size: pageSize,
        _t: new Date().getTime(),
        ...filters
      };
      // Remove empty/null/undefined params
      Object.keys(params).forEach(key => {
        if (params[key] === '' || params[key] == null) delete params[key];
      });
      
      console.log('Fetching events with params:', JSON.stringify(params));
      
      const response = await axios.get('/api/events', { params });
      
      console.log('API response:', {
        total: response.data.total,
        dataLength: response.data.data.length,
        page: params.page
      });
      
      setEvents(response.data.data);
      setTotalEvents(response.data.total);
      setLoading(false);
    } catch (error) {
      console.error('Error fetching events:', error);
      setLoading(false);
    }
  };

  const handleFilterChange = (newFilters, newTopPercent = topPercent) => {
    setCurrentPage(1); // Reset to first page when filters change
    setFilters(newFilters);
    setTopPercent(newTopPercent);
  };

  const handlePageChange = (page) => {
    setCurrentPage(page);
  };

  // 导出全部筛选结果为CSV（前端格式化）
  const handleExportCSV = async () => {
    try {
      // 拉取所有筛选结果（不分页）
      const params = { ...filters, page: 1, page_size: 10000 };
      Object.keys(params).forEach(key => {
        if (params[key] === '' || params[key] == null) delete params[key];
      });
      const response = await axios.get('/api/events', { params });
      const allData = response.data.data;
      // 格式化数据（与表格一致）
      const dosageUnitMap = {
        '001': 'mg', '002': 'g', '003': 'ml', '004': 'units', '005': 'ug', '006': 'ng', '007': 'meq', '008': 'mmol', '009': '%', '010': 'IU'
      };
      const getDrugName = (name) => {
        if (!name) return '';
        const n = name.toLowerCase();
        if (n === 'semaglutide') return 'Semaglutide';
        if (n === 'tirzepatide') return 'Tirzepatide';
        return name.charAt(0).toUpperCase() + name.slice(1).toLowerCase();
      };
      const getSeverityText = (serious) => serious === 1 ? 'Serious' : 'Non-serious';
      const getGenderText = (genderCode) => genderCode === 1 ? 'Male' : genderCode === 2 ? 'Female' : 'Unknown';
      const formatRoute = (route) => route ? route.charAt(0).toUpperCase() + route.slice(1).toLowerCase() : 'Unknown';
      const getDosage = (num, unit) => {
        if (!num) return 'Unknown';
        if (unit && dosageUnitMap[unit]) return `${num} ${dosageUnitMap[unit]}`;
        if (unit) return `${num} ${unit}`;
        return num;
      };
      const formatDate = (dateStr) => {
        if (!dateStr || dateStr.length !== 8) return 'Unknown';
        return `${dateStr.substring(0, 4)}-${dateStr.substring(4, 6)}-${dateStr.substring(6, 8)}`;
      };
      const csvData = allData.map(event => ({
        'Report ID': event.top_safetyreportid,
        'Report Date': formatDate(event.top_receivedate),
        'Event Country': event.top_occurcountry || 'Unknown',
        'Medication': getDrugName(event.drug_medicinalproduct),
        'Adverse Event': event.reaction_reactionmeddrapt,
        'Severity': getSeverityText(event.top_serious),
        'Gender': getGenderText(event.patient_patientsex),
        'Age': event.patient_patientonsetage != null ? parseInt(event.patient_patientonsetage, 10) : 'Unknown',
        'Weight (kg)': event.patient_patientweight != null ? event.patient_patientweight : 'Unknown',
        'Route': formatRoute(event.drug_openfda_route),
        'Start Date': formatDate(event.drug_drugstartdate) || 'Unknown',
        'End Date': formatDate(event.drug_drugenddate) || 'Unknown',
        'Dosage': getDosage(event.drug_drugstructuredosagenumb, event.drug_drugstructuredosageunit)
      }));
      const csv = Papa.unparse(csvData);
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', 'events_export.csv');
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (error) {
      alert('Failed to export CSV.');
    }
  };

  return (
    <div className="app">
      <header className="app-header">
        <div className="container">
          <h1>FDA Weight Loss Drug Adverse Events: ETL & Knowledge Graph</h1>
          <div style={{ fontWeight: 'bold', fontSize: '18px', marginTop: '6px' }}>Automated Pipeline and Visualization</div>
        </div>
      </header>
      
      <main className="container">
        <Filter 
          medications={medications}
          adverseEvents={adverseEvents}
          onFilterChange={handleFilterChange}
          onExportCSV={handleExportCSV}
          topPercent={topPercent}
          setTopPercent={setTopPercent}
          totalAdverseEvents={adverseEvents.length}
        />
        
        <KnowledgeGraph 
          events={allEvents}
          loading={loading}
          filters={filters}
          topPercent={topPercent}
        />
        
        <EventTable 
          events={events}
          loading={loading}
          totalEvents={totalEvents}
          currentPage={currentPage}
          pageSize={pageSize}
          onPageChange={handlePageChange}
        />
      </main>
      
      <footer className="app-footer">
        <div className="container">
          <p>Data source: OpenFDA Adverse Events API</p>
        </div>
      </footer>
    </div>
  );
}

export default App; 