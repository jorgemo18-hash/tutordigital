export function getLoginTemplate() {
  return `
    <div class="loginView">
      <div class="loginCard">
        <span class="tag">Tutordigital</span>
        <h1>Zona docente</h1>
        <p>Introduce el código de acceso para continuar.</p>
        <div class="formField">
          <label for="accessCode">Código</label>
          <input id="accessCode" type="password" placeholder="lyceo" autocomplete="one-time-code">
        </div>
        <div class="modalActions">
          <button class="btn primary" id="accessBtn" type="button">Entrar</button>
        </div>
        <p class="hint" id="tenantLoginName">Centro: —</p>
        <p class="hint">Código demo: <strong>lyceo</strong></p>
      </div>
    </div>
  `;
}

export function getDashboardTemplate() {
  return `
    <main class="appShell" role="main">
      <header class="appHeader">
        <div class="brand">
          <div class="tLogo">T</div>
          <span class="brandName">TutorDigital</span>
        </div>

        <div class="headerCenter">
          <div class="headerInfo">
            <span id="teacherName">—</span>
            <span id="tenantName" class="meta">Centro</span>
          </div>
          <label class="groupSelect center">
            <span>Grupo</span>
            <div class="groupCenterRow">
              <select id="groupSelect" aria-label="Seleccionar grupo"></select>
            </div>
          </label>
          <label class="inlineSelect" id="subjectSelectWrap" style="display:none">
            <span>Asignatura</span>
            <select id="subjectSelect" aria-label="Filtrar por asignatura">
              <option value="">Todas las asignaturas</option>
            </select>
          </label>
          <label class="inlineSelect" id="teacherSelectWrap" style="display:none">
            <span>Profe</span>
            <select id="teacherSelect" aria-label="Profesor">
              <option value="p1">Profe A</option>
              <option value="p2">Profe B</option>
            </select>
          </label>
        </div>

        <div class="headerActions right">
          <div id="headerNav"></div>
        </div>
      </header>

      <div class="teacher-main">

        <!-- Agenda -->
        <section class="panel tasksPanel agenda-section">
          <div class="panelHeader">
            <div>
              <h2>Agenda</h2>
              <div class="panelHint">Filtra por fecha</div>
            </div>
            <div class="taskActions">
              <div class="tabs" role="tablist">
                <button class="tabBtn copper-chip is-active" data-range="today" type="button">Hoy</button>
                <button class="tabBtn copper-chip" data-range="tomorrow" type="button">Mañana</button>
                <button class="tabBtn copper-chip" data-range="week" type="button">7 días</button>
              </div>
              <button class="btn copper-cta" id="addTaskBtn" type="button">+ Añadir</button>
            </div>
          </div>
          <div class="taskSections">
            <div class="taskSection">
              <div class="taskSectionHead">Deberes</div>
              <div class="taskList" id="taskListHomework"></div>
              <p class="emptyState" id="emptyHomework">Sin deberes en este rango.</p>
            </div>
            <div class="taskSection">
              <div class="taskSectionHead">Exámenes</div>
              <div class="taskList" id="taskListExam"></div>
              <p class="emptyState" id="emptyExam">Sin exámenes en este rango.</p>
            </div>
            <div class="taskSection">
              <div class="taskSectionHead">Trabajos</div>
              <div class="taskList" id="taskListWork"></div>
              <p class="emptyState" id="emptyWork">Sin trabajos en este rango.</p>
            </div>
          </div>
        </section>

        <!-- Cuaderno -->
        <section class="panel notebookPanel">
          <div class="panelHeader">
            <div>
              <h2>Cuaderno</h2>
              <span class="panelHint">Resumen por periodo</span>
            </div>
            <div class="notebookControls">
              <label class="inlineSelect">
                <span>Periodo</span>
                <select id="notebookMode" aria-label="Periodo del cuaderno">
                  <option value="week">Semana</option>
                  <option value="month">Mes</option>
                  <option value="term">Trimestre</option>
                  <option value="custom">Personalizado</option>
                </select>
              </label>
              <label class="inlineSelect" id="notebookMonthWrap" style="display:none">
                <span>Mes</span>
                <select id="notebookMonth" aria-label="Mes"></select>
              </label>
              <label class="inlineSelect" id="notebookTermWrap" style="display:none">
                <span>Trimestre</span>
                <select id="notebookTerm" aria-label="Trimestre">
                  <option value="t1">1º</option>
                  <option value="t2">2º</option>
                  <option value="t3">3º</option>
                </select>
              </label>
              <div id="notebookWeekNav" class="weekNav" style="display:flex">
                <button class="btn ghost" id="notebookWeekPrev" type="button">←</button>
                <span id="notebookWeekLabel" class="weekLabel">—</span>
                <button class="btn ghost" id="notebookWeekNext" type="button">→</button>
              </div>
              <div id="notebookCustomWrap" class="notebookCustomDates" style="display:none">
                <input id="notebookFromDate" type="date" aria-label="Desde">
                <span>–</span>
                <input id="notebookToDate" type="date" aria-label="Hasta">
              </div>
              <label class="inlineSelect" id="notebookViewWrap" style="display:none">
                <span>Vista</span>
                <select id="notebookViewMode" aria-label="Vista">
                  <option value="student">Alumno</option>
                  <option value="class">Clase</option>
                </select>
              </label>
            </div>
          </div>
          <div class="notebookWrap">
            <div class="notebookGrid" id="notebookGrid"></div>
          </div>
          <p class="emptyState" id="notebookEmpty">No hay alumnos en este grupo.</p>
        </section>

      </div>
    </main>

    <div class="modalOverlay" id="taskModal" aria-hidden="true">
      <div class="modalCard">
        <div class="modalHeader">
          <h2>Nueva tarea</h2>
          <button class="iconBtn" data-close="taskModal" type="button">✕</button>
        </div>
        <form class="formGrid" id="taskForm">
          <label class="formField">
            <span>Tipo</span>
            <select id="taskType">
              <option value="homework">Deberes</option>
              <option value="exam">Examen</option>
              <option value="work">Trabajo</option>
            </select>
          </label>
          <label class="formField">
            <span>Asignatura</span>
            <select id="taskSubject">
              <option value="">— Sin asignatura —</option>
              <option value="Matemáticas">Matemáticas</option>
              <option value="Lengua">Lengua</option>
              <option value="Historia">Historia</option>
              <option value="Inglés">Inglés</option>
              <option value="Biología">Biología</option>
              <option value="Física">Física</option>
              <option value="Tecnología">Tecnología</option>
            </select>
          </label>
          <label class="formField">
            <span>Entrega</span>
            <input id="taskDate" type="date">
          </label>
          <label class="formField">
            <span>Título</span>
            <input id="taskTitle" type="text" placeholder="Lectura capítulo 2">
          </label>
          <label class="formField">
            <span>Grupo</span>
            <select id="taskGroup"></select>
          </label>
          <label class="formField" style="grid-column:1/-1">
            <span>Notas para el grupo</span>
            <textarea id="taskDesc" rows="3" placeholder="Apuntar dudas clave."></textarea>
          </label>
          <label class="formField" style="grid-column:1/-1">
            <span>Instrucciones para el alumno <span style="font-weight:400;color:var(--ink-mute)">(opcional)</span></span>
            <textarea id="taskNotes" rows="2" placeholder="Ej: Haz los ejercicios 4 y 6 de la página 32"></textarea>
          </label>
        </form>
        <div class="attachmentsBlock">
          <div class="attachmentsHeader">
            <div>Adjuntos</div>
            <button class="btn ghost" id="taskAddFileBtn" type="button">Añadir archivo</button>
          </div>
          <input id="taskFileInput" type="file" accept="image/*,application/pdf,.docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document" hidden>
          <ul class="attachmentList" id="taskAttachmentList"></ul>
          <p class="hint" id="taskAttachmentEmpty">Sin adjuntos.</p>
        </div>
        <div class="modalActions">
          <button class="btn primary" type="submit" form="taskForm">Guardar</button>
          <button class="btn ghost" data-close="taskModal" type="button">Cancelar</button>
        </div>
      </div>
    </div>

    <div class="modalOverlay" id="ticketModal" aria-hidden="true">
      <div class="modalCard">
        <div class="modalHeader">
          <h2 id="ticketTitle">Ticket</h2>
          <button class="iconBtn" data-close="ticketModal" type="button">✕</button>
        </div>
        <div class="ticketDetail" id="ticketDetail"></div>
        <div class="modalActions">
          <button class="btn primary" id="ticketResolveBtn" type="button">Marcar resuelto</button>
          <button class="btn ghost" data-close="ticketModal" type="button">Cerrar</button>
        </div>
      </div>
    </div>

    <div class="modalOverlay" id="taskDetailModal" aria-hidden="true">
      <div class="modalCard wide">
        <div class="modalHeader">
          <h2 id="taskDetailTitle">Detalle tarea</h2>
          <button class="iconBtn" data-close="taskDetailModal" type="button">✕</button>
        </div>
        <div class="ticketDetail" id="taskDetailBody"></div>
        <div class="attachmentsBlock">
          <div class="attachmentsHeader">
            <div>Adjuntos</div>
          </div>
          <ul class="attachmentList" id="taskDetailAttachments"></ul>
          <p class="hint" id="taskDetailEmpty">Sin adjuntos.</p>
        </div>
        <div class="modalActions">
          <button class="btn ghost" data-close="taskDetailModal" type="button">Cerrar</button>
        </div>
      </div>
    </div>

    <div class="modalOverlay" id="notebookDetailModal" aria-hidden="true">
      <div class="modalCard wide">
        <div class="modalHeader">
          <h2 id="notebookDetailTitle">Detalle</h2>
          <button class="iconBtn" data-close="notebookDetailModal" type="button" aria-label="Cerrar">✕</button>
        </div>
        <div class="ticketDetail" id="notebookDetailBody"></div>
        <div class="modalActions">
          <button class="btn ghost" data-close="notebookDetailModal" type="button">Cerrar</button>
        </div>
      </div>
    </div>

    <div class="modalOverlay" id="taskGradeModal" aria-hidden="true">
      <div class="modalCard wide">
        <div class="modalHeader">
          <h2 id="taskGradeTitle">Notas</h2>
          <button class="iconBtn" data-close="taskGradeModal" type="button" aria-label="Cerrar">✕</button>
        </div>
        <form id="taskGradeForm">
          <div class="formGrid">
            <div class="formField">
              <label for="taskGradeStudent">Alumno</label>
              <select id="taskGradeStudent"></select>
            </div>
            <div class="formField">
              <label for="taskGradeScore">Nota</label>
              <input id="taskGradeScore" type="text" placeholder="Ej. 7.5, B+, Apto" required>
            </div>
          </div>
          <div class="modalActions">
            <button class="btn copper-cta" type="submit" id="taskGradeSaveBtn">Guardar</button>
          </div>
        </form>
        <div class="attachmentsBlock" style="margin-top:10px">
          <div class="attachmentsHeader"><div>Notas registradas</div></div>
          <ul class="attachmentList" id="taskGradeList"></ul>
          <p class="hint" id="taskGradeEmpty">Sin notas aún.</p>
        </div>
        <div class="modalActions">
          <button class="btn ghost" data-close="taskGradeModal" type="button">Cerrar</button>
        </div>
      </div>
    </div>

    <div class="modalOverlay" id="gradesModal" aria-hidden="true">
      <div class="modalCard wide">
        <div class="modalHeader">
          <h2 id="gradesTitle">Notas</h2>
          <button class="iconBtn" data-close="gradesModal" type="button" aria-label="Cerrar">✕</button>
        </div>

        <form id="gradeForm">
          <div class="formGrid">
            <div class="formField">
              <label for="gradeTitle">Prueba</label>
              <input id="gradeTitle" type="text" placeholder="Ej. Examen Tema 3" required>
            </div>
            <div class="formField">
              <label for="gradeDate">Fecha</label>
              <input id="gradeDate" type="date" required>
            </div>
            <div class="formField">
              <label for="gradeScore">Nota</label>
              <input id="gradeScore" type="text" placeholder="Ej. 7,5 / 10" required>
            </div>
          </div>
          <div class="modalActions">
            <button class="btn copper-cta" type="submit">Añadir nota</button>
          </div>
        </form>

        <div class="attachmentsBlock" style="margin-top:10px">
          <div class="attachmentsHeader">
            <div>Historial</div>
          </div>
          <ul class="attachmentList" id="gradeList"></ul>
          <p class="hint" id="gradeEmpty">Sin notas.</p>
        </div>

        <div class="modalActions">
          <button class="btn ghost" data-close="gradesModal" type="button">Cerrar</button>
        </div>
      </div>
    </div>

  `;
}

export function renderLoginView(appRoot, ctx) {
  appRoot.innerHTML = getLoginTemplate();
  ctx.setElements(ctx.cacheLoginElements());
  ctx.bindLoginEvents();
  ctx.elements.accessCode?.focus();
}

export function renderDashboard(appRoot, ctx) {
  appRoot.innerHTML = getDashboardTemplate();
  ctx.setElements(ctx.cacheDashboardElements());
  ctx.renderAll();
  ctx.bindDashboardEvents();
}
