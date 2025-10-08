// workers/parser.thread.js
// ---------------------------------------------
// 이 파일은 'react-native-threads'에 의해 별도 스레드에서 실행됩니다.
// postMessage, onmessage는 전역 스코프에 주입되어 있습니다.

onmessage = (e) => {
  const rawJson = e.data;
  
  if (typeof rawJson !== 'string') {
    postMessage(JSON.stringify({ 
      ok: false, 
      error: 'Input must be a JSON string.' 
    }));
    return;
  }

  try {
    // 💡 메인 스레드를 블로킹하던 10초 작업이 여기서 실행됨.
    const result = JSON.parse(rawJson); 

    // 성공적으로 파싱된 결과를 메인 스레드로 반환
    postMessage(JSON.stringify({ 
      ok: true, 
      result: result 
    }));
    
  } catch (parseError) {
    // 파싱 오류 발생 시 오류 메시지를 메인 스레드로 반환
    postMessage(JSON.stringify({ 
      ok: false, 
      error: parseError.message || 'JSON parsing failed in worker.' 
    }));
  }
};