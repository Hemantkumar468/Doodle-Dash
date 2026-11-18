import { useSelector } from 'react-redux';
export function useSocketStatus() { return useSelector((state) => state.session.socketStatus); }
